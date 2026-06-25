import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { SeatStatus, BookingStatus } from '@prisma/client';
import { BOOKING_QUEUE, BookingExpiryJobData } from './processor/booking-expiry.processor';

const LOCK_DURATION_MINUTES = 10; // kursi di-lock selama 10 menit
const BOOKING_EXPIRY_MINUTES = 10; // booking PENDING expired dalam 10 menit

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(BOOKING_QUEUE) private readonly bookingQueue: Queue,
  ) {}

  async create(dto: CreateBookingDto) {
    // cek idempotency — kalau key ini sudah pernah dipakai, return booking yang lama
    const existingBooking = await this.prisma.booking.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { items: true },
    });
    if (existingBooking) return existingBooking;

    // fetch seat availability
    const seatAvailability = await this.prisma.seatAvailability.findUnique({
      where: { id: dto.seatAvailabilityId },
      include: {
        schedule: true,
        seat: { include: { car: true } },
      },
    });

    if (!seatAvailability) {
      throw new NotFoundException(`Seat availability ${dto.seatAvailabilityId} not found`);
    }

    // cek apakah kursi masih AVAILABLE
    if (seatAvailability.status !== SeatStatus.AVAILABLE) {
      throw new ConflictException(
        `Seat ${seatAvailability.seat.seatNumber} is no longer available`,
      );
    }

    const now = new Date();
    const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000);
    const expiresAt = new Date(now.getTime() + BOOKING_EXPIRY_MINUTES * 60 * 1000);

    // optimistic locking — update hanya kalau version masih sama
    // kalau ada request lain yang duluan update, version sudah berubah dan updateCount = 0
    const updateResult = await this.prisma.seatAvailability.updateMany({
      where: {
        id: dto.seatAvailabilityId,
        status: SeatStatus.AVAILABLE, // pastikan masih AVAILABLE
        version: seatAvailability.version, // pastikan belum ada yang update duluan
      },
      data: {
        status: SeatStatus.LOCKED,
        lockedUntil,
        version: { increment: 1 }, // increment version supaya concurrent request lain gagal
      },
    });

    // kalau updateCount = 0, berarti ada request lain yang lebih duluan lock kursi ini
    if (updateResult.count === 0) {
      throw new ConflictException(
        `Seat ${seatAvailability.seat.seatNumber} was just taken. Please choose another seat`,
      );
    }

    // buat booking + booking item dalam satu transaction
    const booking = await this.prisma.booking.create({
      data: {
        userId: dto.userId,
        scheduleId: seatAvailability.scheduleId,
        idempotencyKey: dto.idempotencyKey,
        expiresAt,
        items: {
          create: {
            seatAvailabilityId: dto.seatAvailabilityId,
            price: 150000, // hardcode dulu, nanti bisa dynamic berdasarkan class gerbong
          },
        },
      },
      include: { items: true },
    });

    // enqueue job untuk auto-expire booking kalau user gak bayar
    await this.bookingQueue.add(
      'expire-booking',
      { bookingId: booking.id, seatAvailabilityId: dto.seatAvailabilityId } as BookingExpiryJobData,
      { delay: BOOKING_EXPIRY_MINUTES * 60 * 1000 }, // trigger setelah 10 menit
    );

    return booking;
  }

  async confirm(id: string) {
    // simulasi payment success — update booking jadi CONFIRMED
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!booking) throw new NotFoundException(`Booking ${id} not found`);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Booking is already ${booking.status.toLowerCase()}`,
      );
    }

    // update booking + seat dalam satu transaction
    await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id },
        data: { status: BookingStatus.CONFIRMED },
      }),
      this.prisma.seatAvailability.update({
        where: { id: booking.items[0].seatAvailabilityId },
        data: { status: SeatStatus.BOOKED },
      }),
    ]);

    return { message: 'Booking confirmed. Your seat is secured!' };
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            seatAvailability: {
              include: { seat: { include: { car: true } } },
            },
          },
        },
      },
    });

    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    return booking;
  }
}
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, CACHE_KEYS, TTL } from '../cache/cache.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { SeatStatus, BookingStatus } from '@prisma/client';
import { BOOKING_QUEUE, BookingExpiryJobData } from './processor/booking-expiry.processor';
import { WaitingRoomService } from 'src/waiting-room/waiting-room.service';

const LOCK_DURATION_MINUTES = 10;
const BOOKING_EXPIRY_MINUTES = 10;

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly waitingroom: WaitingRoomService,
    @InjectQueue(BOOKING_QUEUE) private readonly bookingQueue: Queue,
  ) {}

  async create(dto: CreateBookingDto) {
    //Check whether the user has an active slot or not
    const roomStatus = await this.waitingroom.getStatus(
      dto.scheduleId,
      dto.userId
    )
    // cek idempotency dulu
    const existingBooking = await this.prisma.booking.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { items: true },
    });
    if (existingBooking) return existingBooking;

    // cek cache seat availability dulu sebelum ke DB
    const cacheKey = CACHE_KEYS.seatAvailability(dto.seatAvailabilityId);
    let seatAvailability = await this.cache.get<any>(cacheKey);

    if (!seatAvailability) {
      // cache miss — query DB
      seatAvailability = await this.prisma.seatAvailability.findUnique({
        where: { id: dto.seatAvailabilityId },
        include: {
          schedule: true,
          seat: { include: { car: true } },
        },
      });

      if (!seatAvailability) {
        throw new NotFoundException(`Seat availability ${dto.seatAvailabilityId} not found`);
      }

      // simpan ke cache — tapi hanya kalau masih AVAILABLE
      // tidak ada gunanya cache kursi yang sudah LOCKED/BOOKED
      if (seatAvailability.status === SeatStatus.AVAILABLE) {
        await this.cache.set(cacheKey, seatAvailability, TTL.SEAT_AVAILABILITY);
      }
    }

    // cek status — kalau dari cache statusnya LOCKED/BOOKED, langsung reject
    // tidak perlu ke DB sama sekali
    if (seatAvailability.status !== SeatStatus.AVAILABLE) {
      throw new ConflictException(
        `Seat ${seatAvailability.seat.seatNumber} is no longer available`,
      );
    }

    const now = new Date();
    const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000);
    const expiresAt = new Date(now.getTime() + BOOKING_EXPIRY_MINUTES * 60 * 1000);

    // optimistic locking — ini tetap harus ke DB, tidak bisa lewat cache
    const updateResult = await this.prisma.seatAvailability.updateMany({
      where: {
        id: dto.seatAvailabilityId,
        status: SeatStatus.AVAILABLE,
        version: seatAvailability.version,
      },
      data: {
        status: SeatStatus.LOCKED,
        lockedUntil,
        version: { increment: 1 },
      },
    });

    if (updateResult.count === 0) {
      // kursi baru saja diambil orang lain — invalidate cache supaya request
      // berikutnya dapat data fresh dari DB
      await this.cache.del(cacheKey);
      throw new ConflictException(
        `Seat ${seatAvailability.seat.seatNumber} was just taken. Please choose another seat`,
      );
    }

    // booking berhasil — invalidate cache seat availability ini
    // supaya user lain langsung tau kursi sudah tidak available
    await this.cache.del(cacheKey);

    const booking = await this.prisma.booking.create({
      data: {
        userId: dto.userId,
        scheduleId: seatAvailability.scheduleId,
        idempotencyKey: dto.idempotencyKey,
        expiresAt,
        items: {
          create: {
            seatAvailabilityId: dto.seatAvailabilityId,
            price: 150000,
          },
        },
      },
      include: { items: true },
    });

    await this.bookingQueue.add(
      'expire-booking',
      { bookingId: booking.id, seatAvailabilityId: dto.seatAvailabilityId } as BookingExpiryJobData,
      { delay: BOOKING_EXPIRY_MINUTES * 60 * 1000 },
    );

    return booking;
  }

  async confirm(id: string) {
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
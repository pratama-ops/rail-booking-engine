import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus, SeatStatus } from '@prisma/client';

// nama queue harus sama dengan yang didaftarkan di BookingModule
export const BOOKING_QUEUE = 'booking';

// payload yang dikirim waktu job di-enqueue
export interface BookingExpiryJobData {
  bookingId: string;
  seatAvailabilityId: string;
}

@Processor(BOOKING_QUEUE)
export class BookingExpiryProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<BookingExpiryJobData>) {
    const { bookingId, seatAvailabilityId } = job.data;

    // fetch booking, pastikan masih PENDING sebelum di-expire
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    // kalau booking sudah CONFIRMED atau CANCELLED, skip — gak perlu di-expire
    if (!booking || booking.status !== BookingStatus.PENDING) return;

    // jalankan dalam transaction supaya booking + seat update atomic
    await this.prisma.$transaction([
      // expire booking
      this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.EXPIRED },
      }),
      // kembalikan kursi ke AVAILABLE
      this.prisma.seatAvailability.update({
        where: { id: seatAvailabilityId },
        data: {
          status: SeatStatus.AVAILABLE,
          lockedUntil: null,
        },
      }),
    ]);
  }
}
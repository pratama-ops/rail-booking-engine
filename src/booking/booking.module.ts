import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { BookingExpiryProcessor, BOOKING_QUEUE } from './processor/booking-expiry.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: BOOKING_QUEUE }), // daftarkan queue
  ],
  controllers: [BookingController],
  providers: [BookingService, BookingExpiryProcessor],
})
export class BookingModule {}
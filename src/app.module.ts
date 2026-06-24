import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TrainModule } from './train/train.module';
import { CarModule } from './car/car.module';
import { RouteModule } from './route/route.module';
import { ScheduleModule } from './schedule/schedule.module';
import { BookingModule } from './booking/booking.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PrismaModule,
    TrainModule,
    CarModule,
    RouteModule,
    ScheduleModule,
    BookingModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TrainModule } from './train/train.module';
import { CarModule } from './car/car.module';
import { RouteModule } from './route/route.module';

@Module({
  imports: [PrismaModule, TrainModule, CarModule, RouteModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

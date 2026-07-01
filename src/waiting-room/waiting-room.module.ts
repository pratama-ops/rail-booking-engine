import { Module } from '@nestjs/common';
import { WaitingRoomService } from './waiting-room.service';
import { WaitingRoomController } from './waiting-room.controller';

@Module({
  controllers: [WaitingRoomController],
  providers: [WaitingRoomService],
})
export class WaitingRoomModule {}

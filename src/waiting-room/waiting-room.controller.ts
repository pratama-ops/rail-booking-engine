import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { WaitingRoomService } from './waiting-room.service';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class EnterWaitingRoomDto {
  @ApiProperty({ example: 'uuid-user' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

@Controller('waiting-room')
export class WaitingRoomController {
  constructor(private readonly waitingRoomService: WaitingRoomService) {}

  // user masuk waiting room sebelum booking
  @Post(':scheduleId/enter')
  enter(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: EnterWaitingRoomDto,
  ) {
    return this.waitingRoomService.enter(scheduleId, dto.userId);
  }

  // user cek status antrian — frontend polling ini setiap beberapa detik
  @Get(':scheduleId/status/:userId')
  getStatus(
    @Param('scheduleId') scheduleId: string,
    @Param('userId') userId: string,
  ) {
    return this.waitingRoomService.getStatus(scheduleId, userId);
  }
}
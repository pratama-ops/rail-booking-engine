import { Controller } from '@nestjs/common';
import { WaitingRoomService } from './waiting-room.service';

@Controller('waiting-room')
export class WaitingRoomController {
  constructor(private readonly waitingRoomService: WaitingRoomService) {}
}

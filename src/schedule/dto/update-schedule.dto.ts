import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateScheduleDto } from './create-schedule.dto';

// trainId dan routeId tidak boleh diubah setelah schedule dibuat
export class UpdateScheduleDto extends PartialType(
  OmitType(CreateScheduleDto, ['trainId', 'routeId'] as const),
) {}
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateCarDto } from './create-car.dto';

// trainId dan carNumber tidak boleh diubah setelah dibuat
export class UpdateCarDto extends PartialType(OmitType(CreateCarDto, ['trainId', 'carNumber'] as const)) {}
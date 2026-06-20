import { PartialType } from '@nestjs/swagger';
import { CreateTrainDto } from './create-train.dto';

export class UpdateTrainDto extends PartialType(CreateTrainDto) {}

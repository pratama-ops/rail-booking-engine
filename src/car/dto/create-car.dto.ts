import { IsString, IsNotEmpty, IsInt, IsEnum, Min } from 'class-validator';
import { CarClass } from '@prisma/client';

export class CreateCarDto {
  @IsString()
  @IsNotEmpty()
  trainId: string;

  @IsInt()
  @Min(1)
  carNumber: number;

  @IsEnum(CarClass)
  class: CarClass;

  @IsInt()
  @Min(1)
  totalSeats: number;
}
import { IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ example: 'uuid-train' })
  @IsString()
  @IsNotEmpty()
  trainId: string;

  @ApiProperty({ example: 'uuid-route' })
  @IsString()
  @IsNotEmpty()
  routeId: string;

  @ApiProperty({ example: '2025-03-28' })
  @IsDateString()
  departureDate: string; // tanggal keberangkatan, e.g. "2025-03-28"

  @ApiProperty({ example: '2025-03-28T08:00:00.000Z' })
  @IsDateString()
  departureTime: string; // jam berangkat dalam ISO format

  @ApiProperty({ example: '2025-03-28T17:00:00.000Z' })
  @IsDateString()
  arrivalTime: string; // jam tiba dalam ISO format
}
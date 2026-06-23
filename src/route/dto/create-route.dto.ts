import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRouteDto {
  @ApiProperty({ example: 'Gambir' })
  @IsString()
  @IsNotEmpty()
  origin: string;

  @ApiProperty({ example: 'Surabaya Pasar Turi' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ example: 725 })
  @IsInt()
  @Min(1)
  distance: number; // dalam km
}
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ example: 'uuid-user' })
  @IsString()
  @IsNotEmpty()
  userId: string; // nanti diganti JWT auth, sekarang manual dulu

  @ApiProperty({ example: 'uuid-seat-availability' })
  @IsUUID()
  @IsNotEmpty()
  seatAvailabilityId: string;

  @ApiProperty({ example: 'unique-idempotency-key' })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string; // client generate ini, untuk prevent double submit
}
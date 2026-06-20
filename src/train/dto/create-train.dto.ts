import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateTrainDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string; // "Argo Bromo Anggrek"

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string; // "KA-1"
}
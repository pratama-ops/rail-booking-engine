import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, CarClass } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';

@Injectable()
export class CarService {
  constructor(private readonly prisma: PrismaService) {}

  // generate seat numbers berdasarkan kelas dan total kursi
  private generateSeatNumbers(carClass: CarClass, totalSeats: number): string[] {
    // economy 4 kolom (A-D), business dan executive 2 kolom (A-B)
    const columns = carClass === CarClass.ECONOMY ? ['A', 'B', 'C', 'D'] : ['A', 'B'];
    const seats: string[] = [];

    let row = 1;
    let generated = 0;

    while (generated < totalSeats) {
      for (const col of columns) {
        if (generated >= totalSeats) break; // stop kalau sudah cukup (handle totalSeats ganjil)
        seats.push(`${row}${col}`);
        generated++;
      }
      row++;
    }

    return seats;
  }

  async create(dto: CreateCarDto) {
    // pastikan train exists dulu
    const train = await this.prisma.train.findUnique({ where: { id: dto.trainId } });
    if (!train) throw new NotFoundException(`Train ${dto.trainId} not found`);

    try {
      return await this.prisma.car.create({
        data: {
          trainId: dto.trainId,
          carNumber: dto.carNumber,
          class: dto.class,
          totalSeats: dto.totalSeats,
          seats: {
            // generate dan insert semua seats sekaligus dalam satu transaction
            create: this.generateSeatNumbers(dto.class, dto.totalSeats).map((seatNumber) => ({
              seatNumber,
            })),
          },
        },
        include: {
          seats: true, // return seats yang baru dibuat
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          `Car number ${dto.carNumber} already exists on train ${dto.trainId}`,
        );
      }
      throw error;
    }
  }

  async findAll(trainId?: string) {
    return this.prisma.car.findMany({
      where: trainId ? { trainId } : undefined, // filter by trainId kalau ada
      include: { seats: true },
    });
  }

  async findOne(id: string) {
    const car = await this.prisma.car.findUnique({
      where: { id },
      include: { seats: true },
    });

    if (!car) throw new NotFoundException(`Car ${id} not found`);
    return car;
  }

  async update(id: string, dto: UpdateCarDto) {
    await this.findOne(id);
    try {
      return await this.prisma.car.update({ where: { id }, data: dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Car number already exists on this train`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.car.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        // P2003 = foreign key constraint — masih ada Seat/SeatAvailability yang terkait
        throw new ConflictException(`Cannot delete car because it still has related data`);
      }
      throw error;
    }
  }
}
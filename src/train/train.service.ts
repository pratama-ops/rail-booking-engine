import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrainDto } from './dto/create-train.dto';
import { UpdateTrainDto } from './dto/update-train.dto';

@Injectable()
export class TrainService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTrainDto) {
    return this.prisma.train.create({ data: dto });
  }

  async findAll() {
    return this.prisma.train.findMany({
      include: { cars: true },
    });
  }

  async findOne(id: string) {
    const train = await this.prisma.train.findUnique({
      where: { id },
      include: { cars: { include: { seats: true } } },
    });

    if (!train) throw new NotFoundException(`Train ${id} not found`);
    return train;
  }

  async update(id: string, dto: UpdateTrainDto) {
    await this.findOne(id);
    return this.prisma.train.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.train.delete({ where: { id } });
  }
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrainService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { name: string; code: string }) {
    return this.prisma.train.create({ data });
  }

  async findAll() {
    return this.prisma.train.findMany({
      include: { cars: true }, // sertakan gerbong
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

  async update(id: string, data: { name?: string; code?: string }) {
    await this.findOne(id); // pastikan exists dulu
    return this.prisma.train.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.train.delete({ where: { id } });
  }
}
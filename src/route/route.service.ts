import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Injectable()
export class RouteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRouteDto) {
    // cegah route duplikat dengan origin + destination yang sama
    const existing = await this.prisma.route.findFirst({
      where: { origin: dto.origin, destination: dto.destination },
    });

    if (existing) {
      throw new ConflictException(
        `Route from ${dto.origin} to ${dto.destination} already exists`,
      );
    }

    return this.prisma.route.create({ data: dto });
  }

  async findAll() {
    return this.prisma.route.findMany();
  }

  async findOne(id: string) {
    const route = await this.prisma.route.findUnique({ where: { id } });
    if (!route) throw new NotFoundException(`Route ${id} not found`);
    return route;
  }

  async update(id: string, dto: UpdateRouteDto) {
    await this.findOne(id);

    //Data sekarang: origin="Gambir", destination="Surabaya"
    // Request update: { "origin": "Bandung" }
    // Tanpa fallback → cek duplikat: origin="Bandung", destination=undefined  ← gak akurat
    // Dengan fallback → cek duplikat: origin="Bandung", destination="Surabaya" ← benar
    
    // kalau origin atau destination diubah, cek duplikat lagi
    if (dto.origin || dto.destination) {
      //pakai current sebagai fallback kalau fieldnya tidak dikirim di request
      const current = await this.findOne(id);
      const existing = await this.prisma.route.findFirst({
        where: {
          origin: dto.origin ?? current.origin,
          destination: dto.destination ?? current.destination,
          NOT: { id }, // exclude diri sendiri dari pengecekan
        },
      });

      if (existing) {
        throw new ConflictException(
          `Route from ${dto.origin} to ${dto.destination} already exists`,
        );
      }
    }

    return this.prisma.route.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.route.delete({ where: { id } });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new ConflictException(`Cannot delete route because it still has related schedules`);
      }
      throw error;
    }
  }
}
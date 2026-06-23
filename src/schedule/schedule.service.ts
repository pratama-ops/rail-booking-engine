import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateScheduleDto) {
    // validasi train exists
    const train = await this.prisma.train.findUnique({
      where: { id: dto.trainId },
      include: {
        cars: {
          include: { seats: true }, // butuh seats untuk generate SeatAvailability
        },
      },
    });
    if (!train) throw new NotFoundException(`Train ${dto.trainId} not found`);

    // validasi route exists
    const route = await this.prisma.route.findUnique({ where: { id: dto.routeId } });
    if (!route) throw new NotFoundException(`Route ${dto.routeId} not found`);

    // validasi departureTime harus sebelum arrivalTime
    if (new Date(dto.departureTime) >= new Date(dto.arrivalTime)) {
      throw new BadRequestException('Departure time must be before arrival time');
    }

    // validasi tidak ada schedule duplikat untuk train yang sama di tanggal yang sama
    const existing = await this.prisma.schedule.findFirst({
      where: {
        trainId: dto.trainId,
        departureDate: new Date(dto.departureDate),
      },
    });
    if (existing) {
      throw new ConflictException(
        `Train ${train.code} already has a schedule on ${dto.departureDate}`,
      );
    }

    // kumpulkan semua seatId dari semua gerbong train ini
    const allSeatIds = train.cars.flatMap((car) => car.seats.map((seat) => seat.id));

    if (allSeatIds.length === 0) {
      throw new BadRequestException(
        `Train ${train.code} has no seats. Add cars first before creating a schedule`,
      );
    }

    // buat schedule sekaligus generate SeatAvailability untuk semua kursi
    return this.prisma.schedule.create({
      data: {
        trainId: dto.trainId,
        routeId: dto.routeId,
        departureDate: new Date(dto.departureDate),
        departureTime: new Date(dto.departureTime),
        arrivalTime: new Date(dto.arrivalTime),
        seatAvailabilities: {
          // satu SeatAvailability per kursi, semua status AVAILABLE by default
          create: allSeatIds.map((seatId) => ({ seatId })),
        },
      },
      include: {
        seatAvailabilities: true,
      },
    });
  }

  async findAll(trainId?: string, routeId?: string) {
    return this.prisma.schedule.findMany({
      where: {
        ...(trainId && { trainId }),
        ...(routeId && { routeId }),
      },
      include: {
        train: true,
        route: true,
      },
    });
  }

  async findOne(id: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        train: true,
        route: true,
        seatAvailabilities: {
          include: { seat: { include: { car: true } } },
        },
      },
    });

    if (!schedule) throw new NotFoundException(`Schedule ${id} not found`);
    return schedule;
  }

  async update(id: string, dto: UpdateScheduleDto) {
    await this.findOne(id);

    // kalau ada perubahan waktu, validasi ulang
    if (dto.departureTime || dto.arrivalTime) {
      const current = await this.findOne(id);
      const newDeparture = new Date(dto.departureTime ?? current.departureTime);
      const newArrival = new Date(dto.arrivalTime ?? current.arrivalTime);

      if (newDeparture >= newArrival) {
        throw new BadRequestException('Departure time must be before arrival time');
      }
    }

    return this.prisma.schedule.update({
      where: { id },
      data: {
        ...(dto.departureDate && { departureDate: new Date(dto.departureDate) }),
        ...(dto.departureTime && { departureTime: new Date(dto.departureTime) }),
        ...(dto.arrivalTime && { arrivalTime: new Date(dto.arrivalTime) }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.schedule.delete({ where: { id } });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new ConflictException(
          `Cannot delete schedule because it still has related bookings`,
        );
      }
      throw error;
    }
  }
}
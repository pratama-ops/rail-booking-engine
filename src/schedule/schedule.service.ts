import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Schedule, Train, Route, SeatAvailability, Seat, Car } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CACHE_KEYS, CacheService, TTL } from 'src/cache/cache.service';
import { promises } from 'dns';

// definisikan tipe lengkap untuk schedule dengan include-nya
type ScheduleWithRelations = Schedule & {
  train: Train;
  route: Route;
  seatAvailabilities: (SeatAvailability & {
    seat: Seat & { car: Car };
  })[];
};

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

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

  async findOne(id: string): Promise<ScheduleWithRelations> {
    const cacheKey = CACHE_KEYS.scheduleDetail(id);

    // cek cache dulu sebelum ke db
    const cached = await this.cache.get<ScheduleWithRelations>(cacheKey); //kasih generic type
    if (cached) return cached; //cache hit, tidak perlu query ke db

    //cache miss, query ke db
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

    //simpan ke cache untuk next request yg datang
    await this.cache.set(cacheKey, schedule, TTL.SCHEDULE_DETAIL);
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

     const updated = await this.prisma.schedule.update({
      where: { id },
      data: {
        ...(dto.departureDate && { departureDate: new Date(dto.departureDate) }),
        ...(dto.departureTime && { departureTime: new Date(dto.departureTime) }),
        ...(dto.arrivalTime && { arrivalTime: new Date(dto.arrivalTime) }),
      },
    });

    //invalidate cache karena data sudah berubah
    await this.cache.del(CACHE_KEYS.scheduleDetail(id));
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      const deleted = await this.prisma.schedule.delete({ where: { id } });
      //invalidate cache karena schedule sdh dihapus
      await this.cache.del(CACHE_KEYS.scheduleDetail(id));
      return deleted;
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
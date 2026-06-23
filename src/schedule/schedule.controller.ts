import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Controller('schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  create(@Body() dto: CreateScheduleDto) {
    return this.scheduleService.create(dto);
  }

  @Get()
  findAll(
    @Query('trainId') trainId?: string,
    @Query('routeId') routeId?: string,
  ) {
    // GET /schedules                     → semua schedule
    // GET /schedules?trainId=xxx         → filter by train
    // GET /schedules?routeId=xxx         → filter by route
    // GET /schedules?trainId=xxx&routeId=yyy → filter keduanya
    return this.scheduleService.findAll(trainId, routeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scheduleService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.scheduleService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.scheduleService.remove(id);
  }
}
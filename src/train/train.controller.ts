import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TrainService } from './train.service';

@Controller('trains')
export class TrainController {
  constructor(private readonly trainService: TrainService) {}

  @Post()
  create(@Body() body: { name: string; code: string }) {
    return this.trainService.create(body);
  }

  @Get()
  findAll() {
    return this.trainService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trainService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; code?: string }) {
    return this.trainService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.trainService.remove(id);
  }
}
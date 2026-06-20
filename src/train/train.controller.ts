import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TrainService } from './train.service';
import { CreateTrainDto } from './dto/create-train.dto';
import { UpdateTrainDto } from './dto/update-train.dto';

@Controller('trains')
export class TrainController {
  constructor(private readonly trainService: TrainService) {}

  @Post()
  create(@Body() dto: CreateTrainDto) {
    return this.trainService.create(dto);
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
  update(@Param('id') id: string, @Body() dto: UpdateTrainDto) {
    return this.trainService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.trainService.remove(id);
  }
}
import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

@Global() // supaya semua module bisa inject CacheService tanpa import manual
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
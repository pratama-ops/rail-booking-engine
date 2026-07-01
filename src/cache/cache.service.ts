import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

// TTL constants — satu tempat, gampang diubah kalau perlu
export const TTL = {
  SEAT_AVAILABILITY: 60,        // 60 detik — sensitif, sering berubah
  TRAIN_DETAIL: 600,            // 10 menit — data master, jarang berubah
  SCHEDULE_DETAIL: 600,         // 10 menit — sama seperti train
} as const;

// cache key patterns — konsisten supaya invalidation tidak salah target
export const CACHE_KEYS = {
  seatAvailability: (scheduleId: string) => `seat_availability:${scheduleId}`,
  trainDetail: (trainId: string) => `train:${trainId}`,
  scheduleDetail: (scheduleId: string) => `schedule:${scheduleId}`,
} as const;

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;

  onModuleInit() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  // simpan data ke Redis dengan TTL dalam detik
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  // ambil data dari Redis, return null kalau tidak ada
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }

  // hapus satu key — dipakai untuk invalidation on write
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  // hapus banyak key sekaligus — dipakai kalau satu action invalidate banyak cache
  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.redis.del(...keys);
  }
}
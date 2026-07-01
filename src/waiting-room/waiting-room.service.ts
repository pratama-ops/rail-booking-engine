import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

const MAX_SLOTS = parseInt(process.env.WAITING_ROOM_MAX_SLOTS ?? '100');

// TTL untuk slot aktif — kalau user dapat slot tapi tidak lanjut booking dalam 5 menit, slot dilepas
const SLOT_TTL_SECONDS = 300;

@Injectable()
export class WaitingRoomService implements OnModuleInit, OnModuleDestroy {
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

  // key helpers
  private queueKey(scheduleId: string) {
    return `waiting_room:${scheduleId}:queue`;
  }

  private slotsKey(scheduleId: string) {
    return `waiting_room:${scheduleId}:slots`;
  }

  private positionKey(scheduleId: string) {
    return `waiting_room:${scheduleId}:position`;
  }

  // user masuk waiting room — return status apakah langsung dapat slot atau harus antri
  async enter(scheduleId: string, userId: string): Promise<{
    status: 'ADMITTED' | 'QUEUED';
    position?: number; // posisi antrian kalau QUEUED
  }> {
    const slotsKey = this.slotsKey(scheduleId);
    const queueKey = this.queueKey(scheduleId);
    const positionKey = this.positionKey(scheduleId);

    // cek apakah user sudah punya slot aktif — prevent double entry
    const alreadyAdmitted = await this.redis.sismember(slotsKey, userId);
    if (alreadyAdmitted) return { status: 'ADMITTED' };

    // cek apakah slot masih tersedia
    const activeSlots = await this.redis.scard(slotsKey);

    if (activeSlots < MAX_SLOTS) {
      // slot tersedia — langsung masuk, set TTL supaya slot tidak nyangkut selamanya
      await this.redis.sadd(slotsKey, userId);
      await this.redis.expire(slotsKey, SLOT_TTL_SECONDS);
      return { status: 'ADMITTED' };
    }

    // slot penuh — masuk antrian
    // cek apakah user sudah ada di antrian sebelumnya
    const existingPosition = await this.redis.hget(positionKey, userId);
    if (existingPosition) {
      return { status: 'QUEUED', position: parseInt(existingPosition) };
    }

    // tambahkan ke akhir antrian
    const queueLength = await this.redis.rpush(queueKey, userId);

    // simpan posisi user di hash untuk quick lookup
    await this.redis.hset(positionKey, userId, queueLength);

    return { status: 'QUEUED', position: queueLength };
  }

  // user selesai booking atau timeout — lepas slot dan panggil user berikutnya
  async release(scheduleId: string, userId: string): Promise<string | null> {
    const slotsKey = this.slotsKey(scheduleId);
    const queueKey = this.queueKey(scheduleId);
    const positionKey = this.positionKey(scheduleId);

    // hapus user dari active slots
    await this.redis.srem(slotsKey, userId);

    // ambil user berikutnya dari antrian (FIFO — dari depan list)
    const nextUserId = await this.redis.lpop(queueKey);

    if (nextUserId) {
      // admit user berikutnya
      await this.redis.sadd(slotsKey, nextUserId);
      await this.redis.expire(slotsKey, SLOT_TTL_SECONDS);

      // hapus dari position hash karena sudah tidak antri lagi
      await this.redis.hdel(positionKey, nextUserId);

      return nextUserId; // return userId yang baru di-admit untuk dikirim notifikasi
    }

    return null; // antrian kosong
  }

  // cek status user — dipakai untuk polling dari frontend
  async getStatus(scheduleId: string, userId: string): Promise<{
    status: 'ADMITTED' | 'QUEUED' | 'NOT_IN_QUEUE';
    position?: number;
    totalQueue?: number;
  }> {
    const slotsKey = this.slotsKey(scheduleId);
    const queueKey = this.queueKey(scheduleId);
    const positionKey = this.positionKey(scheduleId);

    // cek apakah sedang aktif di slot
    const isAdmitted = await this.redis.sismember(slotsKey, userId);
    if (isAdmitted) return { status: 'ADMITTED' };

    // cek apakah sedang antri
    const position = await this.redis.hget(positionKey, userId);
    if (position) {
      const totalQueue = await this.redis.llen(queueKey);
      return {
        status: 'QUEUED',
        position: parseInt(position),
        totalQueue,
      };
    }

    return { status: 'NOT_IN_QUEUE' };
  }
}
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

class CacheService {
  private client: Redis;

  constructor() {
    this.client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.client.on('connect', () => logger.info('Redis connected'));
    this.client.on('error', (err) => logger.error('Redis error', { error: err.message }));
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  // ─── Token Methods ──────────────────────────────────────────────────────────

  async storeRefreshToken(userId: string, token: string, ttlSeconds: number): Promise<void> {
    const key = `${config.redis.prefixes.token}${userId}:${token}`;
    await this.client.setex(key, ttlSeconds, '1');
  }

  async isRefreshTokenValid(userId: string, token: string): Promise<boolean> {
    const key = `${config.redis.prefixes.token}${userId}:${token}`;
    const val = await this.client.get(key);
    return val === '1';
  }

  async revokeRefreshToken(userId: string, token: string): Promise<void> {
    const key = `${config.redis.prefixes.token}${userId}:${token}`;
    await this.client.del(key);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    const pattern = `${config.redis.prefixes.token}${userId}:*`;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  // ─── Blacklist / Revoked Access Tokens ─────────────────────────────────────

  async blacklistAccessToken(jti: string, ttlSeconds: number): Promise<void> {
    const key = `crm:blacklist:${jti}`;
    await this.client.setex(key, ttlSeconds, '1');
  }

  async isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    const key = `crm:blacklist:${jti}`;
    const val = await this.client.get(key);
    return val === '1';
  }

  // ─── Generic Cache ──────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    const val = await this.client.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }
}

export const cacheService = new CacheService();

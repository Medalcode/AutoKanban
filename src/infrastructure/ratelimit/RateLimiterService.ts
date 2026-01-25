import { RateLimiterRedis } from 'rate-limiter-flexible';
import redisClient from '../redis/RedisClient';

export class RateLimiterService {
  private limiters: Map<string, RateLimiterRedis> = new Map();

  async consume(key: string, points: number, duration: number): Promise<void> {
    const limiterKey = `${key}:${points}:${duration}`;
    let limiter = this.limiters.get(limiterKey);

    if (!limiter) {
      limiter = new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'chaos:rl',
        points: points,
        duration: duration,
      });
      this.limiters.set(limiterKey, limiter);
    }

    await limiter.consume(key);
  }
}

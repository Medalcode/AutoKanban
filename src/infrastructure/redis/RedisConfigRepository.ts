import { IConfigRepository } from '../../core/interfaces/repositories';
import { ChaosConfig } from '../../core/domain/types';
import redisClient from './RedisClient';

const KEY_PREFIX = 'chaos:config:';
const LIST_KEY = 'chaos:configs';

export class RedisConfigRepository implements IConfigRepository {
  async save(cfg: ChaosConfig): Promise<void> {
    const key = KEY_PREFIX + cfg.id;
    await redisClient.multi().set(key, JSON.stringify(cfg)).sadd(LIST_KEY, cfg.id).exec();
  }

  async get(id: string): Promise<ChaosConfig | null> {
    const data = await redisClient.get(KEY_PREFIX + id);
    return data ? JSON.parse(data) : null;
  }

  async list(): Promise<ChaosConfig[]> {
    const ids = await redisClient.smembers(LIST_KEY);
    if (ids.length === 0) return [];

    const keys = ids.map((id) => KEY_PREFIX + id);
    const results = await redisClient.mget(...keys);

    return results
      .filter((r): r is string => r !== null)
      .map((r) => JSON.parse(r) as ChaosConfig);
  }

  async delete(id: string): Promise<void> {
    await redisClient.multi().del(KEY_PREFIX + id).srem(LIST_KEY, id).exec();
  }
}

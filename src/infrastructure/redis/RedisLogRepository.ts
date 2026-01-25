import { ILogRepository } from '../../core/interfaces/repositories';
import { RequestLog } from '../../core/domain/types';
import redisClient from './RedisClient';

const LOGS_KEY = 'chaos:logs:global';
const MAX_LOGS = 100;

export class RedisLogRepository implements ILogRepository {
  async log(requestLog: RequestLog): Promise<void> {
    const data = JSON.stringify(requestLog);
    await redisClient
      .pipeline()
      .lpush(LOGS_KEY, data)
      .ltrim(LOGS_KEY, 0, MAX_LOGS - 1)
      .exec();
  }

  async getLatest(limit: number): Promise<RequestLog[]> {
    const rawLogs = await redisClient.lrange(LOGS_KEY, 0, limit - 1);
    return rawLogs
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((l) => l !== null) as RequestLog[];
  }
}

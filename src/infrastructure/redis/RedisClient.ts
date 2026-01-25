import Redis from 'ioredis';
import { config } from '../../config';

const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

export default redisClient;

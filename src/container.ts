import { RedisConfigRepository } from './infrastructure/redis/RedisConfigRepository';
import { RedisLogRepository } from './infrastructure/redis/RedisLogRepository';
import { ConfigService } from './application/services/ConfigService';
import { LogService } from './application/services/LogService';
import { ChaosProxyService } from './application/services/ChaosProxyService';
import { RateLimiterService } from './infrastructure/ratelimit/RateLimiterService';
import { ChaosEngine } from './core/domain/ChaosEngine';
import { ConfigController } from './api/controllers/ConfigController';
import { LogController } from './api/controllers/LogController';

// Infrastructure
const configRepo = new RedisConfigRepository();
const logRepo = new RedisLogRepository();
const rateLimiterService = new RateLimiterService();

// Domain
const chaosEngine = new ChaosEngine();

// Application Services
const configService = new ConfigService(configRepo);
const logService = new LogService(logRepo);
const chaosProxyService = new ChaosProxyService(configRepo, logRepo, chaosEngine, rateLimiterService);

// Controllers
const configController = new ConfigController(configService);
const logController = new LogController(logService);

export {
  configService,
  logService,
  chaosProxyService,
  configController,
  logController
};

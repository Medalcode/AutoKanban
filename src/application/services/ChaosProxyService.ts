import { IConfigRepository, ILogRepository } from '../../core/interfaces/repositories';
import { ChaosEngine } from '../../core/domain/ChaosEngine';
import { ChaosDecision, RequestLog, ChaosConfig } from '../../core/domain/types';
import { RateLimiterService } from '../../infrastructure/ratelimit/RateLimiterService';
import { v4 as uuidv4 } from 'uuid';

export class ChaosProxyService {
  constructor(
    private configRepo: IConfigRepository,
    private logRepo: ILogRepository,
    private chaosEngine: ChaosEngine,
    private rateLimiter: RateLimiterService
  ) {}

  async resolveConfigString(url: string, headers: any): Promise<string | null> {
    let configId = headers['x-chaos-config-id'] as string;
    
    // Path based: /proxy/:id/foo
    if (!configId && url.startsWith('/proxy/')) {
       configId = url.split('/')[2];
    }
    return configId || null;
  }

  async getConfig(id: string): Promise<ChaosConfig | null> {
    // TODO: Add L1 Cache here
    return this.configRepo.get(id);
  }

  async checkRateLimit(config: ChaosConfig): Promise<boolean> {
    if (config.rules && config.rules.rate_limit_per_second) {
      try {
        await this.rateLimiter.consume(config.id, config.rules.rate_limit_per_second, 1);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }

  decideChaos(config: ChaosConfig, req: any): ChaosDecision {
    return this.chaosEngine.decide(config.rules, req);
  }

  fuzzBody(body: any, rate: number): any {
    return this.chaosEngine.fuzzBody(body, rate);
  }

  async logRequest(
    configId: string,
    req: { method: string; originalUrl: string },
    result: { statusCode: number; duration: number; type: string }
  ): Promise<void> {
    const logData: RequestLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      config_id: configId,
      method: req.method,
      path: req.originalUrl,
      status_code: result.statusCode,
      duration_ms: result.duration,
      chaos_type: result.type
    };
    // Fire and forget, but catch errors to avoid unhandled rejections if caller waits
    try {
      await this.logRepo.log(logData);
    } catch (e) {
      console.error('Failed to log request', e);
    }
  }
}

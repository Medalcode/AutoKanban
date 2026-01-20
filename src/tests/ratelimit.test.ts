import request from 'supertest';
jest.mock('ioredis');
import { app } from '../server';
import { redisService } from '../services/redis';
import { ChaosConfig } from '../models/types';
import { RateLimiterRedis } from 'rate-limiter-flexible';

// Mock RateLimiterRedis
jest.mock('rate-limiter-flexible', () => {
    return {
        RateLimiterRedis: jest.fn().mockImplementation(() => {
            return {
                consume: jest.fn().mockImplementation((key, points) => {
                    // Simple mock logic: if key ends with 'blocked', reject
                    if (key === 'blocked_config') {
                        return Promise.reject(new Error('Too Many Requests'));
                    }
                    return Promise.resolve();
                })
            };
        })
    };
});

// We need to setup a config that has rate limiting enabled
const RL_CONFIG_ID = 'rate-limit-config';
const BLOCKED_CONFIG_ID = 'blocked_config';

describe('Rate Limiting Middleware', () => {
    beforeAll(async () => {
        // Setup Configs in Redis (Mock)
        await redisService.saveConfig({
            id: RL_CONFIG_ID,
            name: 'Allowed Config',
            target: 'http://example.com',
            enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            rules: {
                rate_limit_per_second: 100
            }
        });

        await redisService.saveConfig({
            id: BLOCKED_CONFIG_ID,
            name: 'Blocked Config',
            target: 'http://example.com',
            enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            rules: {
                rate_limit_per_second: 1 // We mock the failure based on ID for simplicity in this unit test
            }
        });
    });

    afterAll(async () => {
        await redisService.quit();
    });

    it('should allow request when within limit', async () => {
        const res = await request(app)
            .get('/proxy/' + RL_CONFIG_ID + '/test')
            .set('X-Chaos-Config-ID', RL_CONFIG_ID);
        
        // Should not be 429. Might be 404 (upstream) or 504 (gateway timeout) or 200 (if echo server was upstream, but here upstream is example.com so nock or mock required? 
        // Actually, we haven't mocked the proxy target.
        // But the middleware runs BEFORE proxy.
        // If it passes RL, it goes to chaos engine, then proxy.
        // Since we are mocking redis, it should find the config.
        // It will try to proxy to 'http://example.com'.
        // This might fail or hang if verifying external. 
        // Validation: Expect != 429.
        expect(res.status).not.toBe(429);
    });

    it('should return 429 when limit exceeded', async () => {
        const res = await request(app)
            .get('/proxy/' + BLOCKED_CONFIG_ID + '/test')
            .set('X-Chaos-Config-ID', BLOCKED_CONFIG_ID);
        
        expect(res.status).toBe(429);
        expect(res.text).toBe('Too Many Requests');
    });
});

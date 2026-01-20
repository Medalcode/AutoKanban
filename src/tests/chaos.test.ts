import { chaosEngine } from '../chaos';
jest.mock('ioredis');

import { Request } from 'express';
import { ChaosRules } from '../models/types';

describe('Chaos Engine', () => {
  const mockRequest = {
    method: 'GET',
    path: '/api/users',
    headers: { 'user-agent': 'test-agent' },
    query: {},
    body: {}
  } as unknown as Request;

  it('should return no chaos when rules are empty', () => {
    const rules: ChaosRules = {};
    const decision = chaosEngine.decide(rules, mockRequest);
    expect(decision.shouldError).toBe(false);
    expect(decision.shouldLatency).toBe(false);
  });

  it('should apply fixed latency', () => {
    const rules: ChaosRules = {
      latency_ms: 100
    };
    const decision = chaosEngine.decide(rules, mockRequest);
    expect(decision.shouldLatency).toBe(true);
    expect(decision.latencyMs).toBe(100);
  });

  it('should apply probabilistic error', () => {
    // Mock random to force failure
    jest.spyOn(Math, 'random').mockReturnValue(0.05);

    const rules: ChaosRules = {
      inject_failure_rate: 0.1, // 10%
      error_code: 500
    };

    const decision = chaosEngine.decide(rules, mockRequest);
    expect(decision.shouldError).toBe(true);
    expect(decision.errorCode).toBe(500);

    jest.spyOn(Math, 'random').mockRestore();
  });
});

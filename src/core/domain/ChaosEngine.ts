import { ChaosRules, ChaosDecision } from './types';
import { scriptEngine } from './ScriptEngine';

export class ChaosEngine {
  decide(rules: ChaosRules, req?: any): ChaosDecision {
    const decision: ChaosDecision = {
      shouldLatency: false,
      latencyMs: 0,
      shouldError: false,
      errorCode: 200,
      shouldFuzz: false,
      headers: { ...rules.modify_headers },
    };

    // 1. Error Injection
    if (rules.inject_failure_rate && Math.random() < rules.inject_failure_rate) {
      decision.shouldError = true;
      decision.errorCode = rules.error_code || 500;
      decision.errorBody = rules.error_body || '{"error": "Chaos Engineering: Injected failure"}';
    }

    // 2. Latency Injection
    if (rules.latency_ms && rules.latency_ms > 0) {
      decision.shouldLatency = true;
      let latency = rules.latency_ms;
      if (rules.jitter) {
        const jitter = Math.random() * rules.jitter * 2 - rules.jitter;
        latency += jitter;
      }
      decision.latencyMs = Math.max(0, latency);
    }

    // 3. Response Fuzzing
    if (rules.response_fuzzing?.enabled) {
      if (Math.random() < rules.response_fuzzing.probability) {
        decision.shouldFuzz = true;
      }
    }

// 4. Dynamic Scripting (The God Mode)
    if (rules.script && req) {
      scriptEngine.execute(rules.script, { req, decision });
    }

    return decision;
  }

  fuzzBody(body: any, rate: number): any {
    if (!body) return body;

    let content = body;
    try {
      if (Buffer.isBuffer(body)) content = JSON.parse(body.toString());
      else if (typeof body === 'string') content = JSON.parse(body);
    } catch {
      return body; 
    }

    return this.mutate(content, rate);
  }

  private mutate(obj: any, rate: number): any {
    if (Array.isArray(obj)) {
      return obj.map((v) => this.mutate(v, rate));
    } else if (typeof obj === 'object' && obj !== null) {
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = this.mutate(obj[key], rate);
      }
      return newObj;
    } else {
      if (Math.random() < rate) {
        return this.applyMutation(obj);
      }
      return obj;
    }
  }

  private applyMutation(val: any): any {
    const type = typeof val;
    const choice = Math.floor(Math.random() * 4);

    switch (choice) {
      case 0:
        return null;
      case 1:
        if (type === 'string') return 12345;
        if (type === 'number') return 'should_be_number';
        if (type === 'boolean') return 0;
        return 'swapped';
      case 2:
        if (type === 'string') return val + '_CHAOS';
        if (type === 'number') return val * -1;
        if (type === 'boolean') return !val;
        return val;
      default:
        return val;
    }
  }
}

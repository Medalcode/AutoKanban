import vm from 'vm';
import { ChaosDecision } from './types';

export class ScriptEngine {
  execute(script: string, context: { req: any; decision: ChaosDecision }): void {
    if (!script || script.trim() === '') return;

    try {
      const sandbox = {
        req: {
          method: context.req.method,
          path: context.req.path || context.req.url,
          headers: context.req.headers,
          body: context.req.body,
          query: context.req.query || {}
        },
        decision: context.decision,
        Math: Math,
        console: { log: (...args: any[]) => console.log('[SCRIPT]', ...args) },
        Date: Date
      };

      vm.createContext(sandbox);

      vm.runInContext(script, sandbox, {
        timeout: 50,
        displayErrors: false
      });
    } catch (e) {
      console.warn('JS Script execution failed:', e);
    }
  }
}

export const scriptEngine = new ScriptEngine();

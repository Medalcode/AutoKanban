
const configStore = new Map<string, string>();
const sets = new Map<string, Set<string>>();
const lists = new Map<string, string[]>();

class RedisMock {
  constructor() {}

  async get(key: string) {
    return configStore.get(key) || null;
  }

  async mget(...keys: string[]) {
    return keys.map(k => configStore.get(k) || null);
  }

  async smembers(key: string) {
    return Array.from(sets.get(key) || []);
  }

  async lrange(key: string, start: number, stop: number) {
    const list = lists.get(key) || [];
    // Handle stop -1
    const end = stop === -1 ? undefined : stop + 1;
    return list.slice(start, end);
  }

  // Chainable mocks
  multi() { return this; }
  pipeline() { return this; }
  
  set(key: string, val: string) {
      configStore.set(key, val);
      return this;
  }
  
  sadd(key: string, val: string) {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key)!.add(val);
      return this;
  }

  srem(key: string, val: string) {
      if (sets.has(key)) sets.get(key)!.delete(val);
      return this;
  }

  del(key: string) {
      configStore.delete(key);
      return this;
  }

  lpush(key: string, val: string) {
      if (!lists.has(key)) lists.set(key, []);
      lists.get(key)!.unshift(val);
      return this;
  }

  ltrim(key: string, start: number, stop: number) {
      if (lists.has(key)) {
          const list = lists.get(key)!;
          const end = stop === -1 ? undefined : stop + 1;
          lists.set(key, list.slice(start, end));
      }
      return this;
  }

  async exec() {
      return []; // Return/Resolve promise
  }

  async quit() {
      return 'OK';
  }
  
  on(event: string, cb: Function) {
      // no-op
      return this;
  }
}

export default RedisMock;

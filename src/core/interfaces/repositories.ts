import { ChaosConfig, RequestLog } from '../domain/types';

export interface IConfigRepository {
  save(config: ChaosConfig): Promise<void>;
  get(id: string): Promise<ChaosConfig | null>;
  list(): Promise<ChaosConfig[]>;
  delete(id: string): Promise<void>;
}

export interface ILogRepository {
  log(requestLog: RequestLog): Promise<void>;
  getLatest(limit: number): Promise<RequestLog[]>;
}

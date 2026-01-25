import { ILogRepository } from '../../core/interfaces/repositories';
import { RequestLog } from '../../core/domain/types';

export class LogService {
  constructor(private logRepo: ILogRepository) {}

  async getLogs(limit: number): Promise<RequestLog[]> {
    return this.logRepo.getLatest(limit);
  }
}

import { IConfigRepository } from '../../core/interfaces/repositories';
import { ChaosConfig } from '../../core/domain/types';
import { v4 as uuidv4 } from 'uuid';

export class ConfigService {
  constructor(private configRepo: IConfigRepository) {}

  async createConfig(data: Omit<ChaosConfig, 'id' | 'created_at' | 'updated_at'>): Promise<ChaosConfig> {
    const now = new Date().toISOString();
    const newConfig: ChaosConfig = {
      ...data,
      id: uuidv4(),
      created_at: now,
      updated_at: now
    };
    await this.configRepo.save(newConfig);
    return newConfig;
  }

  async getConfig(id: string): Promise<ChaosConfig | null> {
    return this.configRepo.get(id);
  }

  async listConfigs(): Promise<ChaosConfig[]> {
    return this.configRepo.list();
  }

  async updateConfig(id: string, updates: Partial<ChaosConfig>): Promise<ChaosConfig | null> {
    const existing = await this.configRepo.get(id);
    if (!existing) return null;

    const updated: ChaosConfig = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
      id // ensure ID doesn't change
    };

    await this.configRepo.save(updated);
    return updated;
  }

  async deleteConfig(id: string): Promise<void> {
    await this.configRepo.delete(id);
  }
}

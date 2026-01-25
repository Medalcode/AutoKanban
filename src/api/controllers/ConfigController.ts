import { Request, Response } from 'express';
import { ConfigService } from '../../application/services/ConfigService';

export class ConfigController {
  constructor(private configService: ConfigService) {}

  /**
   * @openapi
   * /api/v1/configs:
   *   post:
   *     summary: Create a new chaos configuration
   *     tags: [Configs]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [target]
   *             properties:
   *               name:
   *                 type: string
   *               target:
   *                 type: string
   *                 description: Target URL to proxy to
   *               enabled:
   *                 type: boolean
   *               rules:
   *                 type: object
   *     responses:
   *       201:
   *         description: Configuration created
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const config = await this.configService.createConfig(req.body);
      res.status(201).json(config);
    } catch (err) {
      res.status(500).json({ error: 'Failed to save config' });
    }
  }

  /**
   * @openapi
   * /api/v1/configs:
   *   get:
   *     summary: List all configurations
   *     tags: [Configs]
   *     responses:
   *       200:
   *         description: List of chaos configurations
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const configs = await this.configService.listConfigs();
      res.json({ configs, count: configs.length });
    } catch (err) {
      res.status(500).json({ error: 'Failed to list configs' });
    }
  }

  /**
   * @openapi
   * /api/v1/configs/{id}:
   *   get:
   *     summary: Get a configuration by ID
   *     tags: [Configs]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Configuration details
   *       404:
   *         description: Not found
   */
  async get(req: Request, res: Response): Promise<void> {
    try {
      const config = await this.configService.getConfig(req.params.id as string);
      if (!config) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json(config);
    } catch (err) {
      res.status(500).json({ error: 'Failed to get config' });
    }
  }

  /**
   * @openapi
   * /api/v1/configs/{id}:
   *   put:
   *     summary: Update a configuration
   *     tags: [Configs]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Updated configuration
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const updated = await this.configService.updateConfig(req.params.id as string, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update config' });
    }
  }

  /**
   * @openapi
   * /api/v1/configs/{id}:
   *   delete:
   *     summary: Delete a configuration
   *     tags: [Configs]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Configuration deleted
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      await this.configService.deleteConfig(req.params.id as string);
      res.status(200).json({ message: 'Deleted', id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete config' });
    }
  }
}

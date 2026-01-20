import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redisService } from '../services/redis';
import { ChaosConfig } from '../models/types';

export const configController = {
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
      const cfg: ChaosConfig = req.body;
      cfg.id = cfg.id || uuidv4();
      cfg.created_at = new Date().toISOString();
      cfg.updated_at = new Date().toISOString();
      cfg.enabled = cfg.enabled !== undefined ? cfg.enabled : true;

      await redisService.saveConfig(cfg);
      res.status(201).json(cfg);
    } catch (err) {
      res.status(500).json({ error: 'Failed to save config' });
    }
  },

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
  async list(req: Request, res: Response) {
    try {
      const configs = await redisService.listConfigs();
      res.json({ configs, count: configs.length });
    } catch (err) {
      res.status(500).json({ error: 'Failed to list configs' });
    }
  },

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
  async get(req: Request, res: Response) {
    try {
      const cfg = await redisService.getConfig(req.params.id as string);
      if (!cfg) return res.status(404).json({ error: 'Not found' });
      res.json(cfg);
    } catch (err) {
      res.status(500).json({ error: 'Failed to get config' });
    }
  },

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
  async update(req: Request, res: Response) {
    try {
      const existing = await redisService.getConfig(req.params.id as string);
      if (!existing) return res.status(404).json({ error: 'Not found' });

      const cfg: ChaosConfig = { ...existing, ...req.body, id: existing.id, updated_at: new Date().toISOString() };
      await redisService.saveConfig(cfg);
      res.json(cfg);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update config' });
    }
  },

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
  async delete(req: Request, res: Response) {
    try {
      await redisService.deleteConfig(req.params.id as string);
      res.status(200).json({ message: 'Deleted', id: req.params.id as string });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete config' });
    }
  },

  /**
   * @openapi
   * /api/v1/logs:
   *   get:
   *     summary: Get global chaos logs
   *     tags: [Logs]
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Number of logs to return
   *     responses:
   *       200:
   *         description: List of request logs
   */
  async getLogs(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await redisService.getLogs(limit);
      res.json({ logs });
    } catch (err) {
      res.status(500).json({ error: 'Failed to get logs' });
    }
  }
};

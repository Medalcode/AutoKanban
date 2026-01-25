import { Request, Response } from 'express';
import { LogService } from '../../application/services/LogService';

export class LogController {
  constructor(private logService: LogService) {}

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
  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await this.logService.getLogs(limit);
      res.json({ logs });
    } catch (err) {
      res.status(500).json({ error: 'Failed to get logs' });
    }
  }
}

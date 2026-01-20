import request from 'supertest';
jest.mock('ioredis');
import { app } from '../server';

describe('Server Smoke Tests', () => {
  it('should respond to /health (if exists) or 404 on unknown routes', async () => {
    const res = await request(app).get('/unknown-route');
    // We expect 404 because no config ID is provided and no /health endpoint is explicit in main text,
    // but the dashboard is static.
    // However, the proxy logic returns 404 for missing config ID.
    expect(res.status).toBe(404);
  });

  it('should serve /metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
  });
});

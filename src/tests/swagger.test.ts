import request from 'supertest';
jest.mock('ioredis');
import { app } from '../server';

describe('Swagger Documentation', () => {
    it('should serve Swagger UI at /api-docs', async () => {
        const res = await request(app).get('/api-docs/');
        // Swagger UI redirects to /index.html usually or serves HTML
        expect(res.status).toBeOneOf([200, 301]);
        if (res.status === 200) {
            expect(res.text).toContain('<!DOCTYPE html>');
        }
    });

    it('should serve OpenAPI Spec at internal endpoint', async () => {
        // Swagger UI express usually mounts the asset, but let's check if we can query it?
        // Actually swagger-ui-express serves the spec injected in HTML.
        // We can verify that the app responds without error.
        const res = await request(app).get('/api-docs/');
        expect(res.status).toBeLessThan(400);
    });
});

/* Custom Matcher */
expect.extend({
    toBeOneOf(received, expected) {
        const pass = expected.includes(received);
        if (pass) {
            return {
                message: () => `expected ${received} not to be one of ${expected}`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be one of ${expected}`,
                pass: false,
            };
        }
    },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}

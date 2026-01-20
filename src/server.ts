import express from 'express';
import { IncomingMessage, ServerResponse, ClientRequest } from 'http';
import { createProxyMiddleware, responseInterceptor, Options } from 'http-proxy-middleware';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import promClient from 'prom-client';
import path from 'path';

import { config } from './config';
import { redisService } from './services/redis';
import { chaosEngine } from './chaos';
import { configController } from './controllers/configController';
import { authMiddleware } from './middleware/auth';
import { ChaosConfig, RequestLog } from './models/types';

// Metrics Setup
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();

const requestCounter = new promClient.Counter({
  name: 'chaos_proxy_requests_total',
  help: 'Total requests',
  labelNames: ['config_id', 'status_code', 'chaos_type']
});

const latencyHistogram = new promClient.Histogram({
  name: 'chaos_proxy_request_duration_seconds',
  help: 'Request latency',
  labelNames: ['config_id', 'chaos_type']
});

const app = express();

// Basic Middleware
app.use(cors());
app.use(express.json()); // NOTE: interfere with proxy body? Only for API routes.
// We should apply json parser only to API routes to avoid messing with proxy streams.

// Static UI
app.use('/dashboard', express.static(path.join(__dirname, '../web')));

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chaos API Proxy Control Plane',
      version: '1.0.0',
      description: 'API for managing chaos configurations and rules.',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Local Server',
      },
    ],
  },
  apis: ['./src/controllers/*.ts', './src/server.ts'], // Files containing annotations
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
const apiRouter = express.Router();
apiRouter.use(express.json());
apiRouter.use(authMiddleware);
apiRouter.post('/configs', configController.create);
apiRouter.get('/configs', configController.list);
apiRouter.get('/configs/:id', configController.get);
apiRouter.put('/configs/:id', configController.update);
apiRouter.delete('/configs/:id', configController.delete);
apiRouter.get('/logs', configController.getLogs);

app.use('/api/v1', apiRouter);
// Alias
app.use('/rules', apiRouter);

// Metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// PROXY LOGIC
// We capture specific path or header
// Helper to resolve config
async function resolveConfig(req: IncomingMessage): Promise<ChaosConfig | null> {
    const url = req.url || '';
    const headers = req.headers || {};
    
    let configId = headers['x-chaos-config-id'] as string;
    
    // Path based: /proxy/:id/foo
    if (url.startsWith('/proxy/')) {
        const parts = url.split('/');
        if (parts.length >= 3) {
            configId = parts[2];
        }
    }

    if (!configId) return null;

    try {
        const cfg = await redisService.getConfig(configId);
        if (!cfg || !cfg.enabled) return null;
        return cfg;
    } catch (e) {
        console.error('Redis Error', e);
        return null;
    }
}

// HTTP Middleware
app.use(async (req, res, next) => {
    // Skip API, Metrics, Dashboard
    if (req.path.startsWith('/api/') || req.path.startsWith('/dashboard') || req.path.startsWith('/metrics') || req.path.startsWith('/rules')) {
        return next();
    }

    const start = Date.now();
    const cfg = await resolveConfig(req);

    if (!cfg) {
        return res.status(404).send('Chaos Proxy: Missing Config ID or Config Not Found');
    }

    // Rate Limiting
    if (cfg.rules && cfg.rules.rate_limit_per_second) {
        try {
            // Create or get limiter for this config
            // We use a simple key based on ID + limit to invalidate if limit changes
            const limitKey = `${cfg.id}:${cfg.rules.rate_limit_per_second}`;
            // For simplicity in this monolithic file, we instantiate a limiter. 
            // Optimally: cache this. `rate-limiter-flexible` is lightweight.
            // But connecting to Redis every time is bad? No, it uses the existing client:
            
            const limiter = new RateLimiterRedis({
                storeClient: redisService.client,
                keyPrefix: 'chaos:rl',
                points: cfg.rules.rate_limit_per_second, 
                duration: 1, // per second
            });

            await limiter.consume(cfg.id); 
        } catch (rej) {
            // 429 Too Many Requests
            return res.status(429).send('Too Many Requests');
        }
    }

    // Make Chaos Decision
    const decision = chaosEngine.decide(cfg.rules, req);
    const chaosType = decision.shouldError ? 'error' : (decision.shouldLatency ? 'latency' : 'none');

    // Store for logging in onFinish
    const logData: RequestLog = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        config_id: cfg.id,
        method: req.method,
        path: req.originalUrl,
        status_code: 200, // placeholder
        duration_ms: 0,
        chaos_type: chaosType
    };

    // 1. Error Injection
    if (decision.shouldError) {
        for (const [k, v] of Object.entries(decision.headers)) res.set(k, v);
        res.status(decision.errorCode).send(decision.errorBody);
        
        // Log
        logData.status_code = decision.errorCode;
        logData.duration_ms = Date.now() - start;
        requestCounter.inc({ config_id: cfg.id, status_code: decision.errorCode, chaos_type: 'error' });
        redisService.logRequest(logData);
        return;
    }

    // 2. Latency Injection
    if (decision.shouldLatency) {
        await new Promise(r => setTimeout(r, decision.latencyMs));
    }

    // Attach data to req for proxy middleware to use
    (req as any).chaosConfig = cfg;
    (req as any).chaosDecision = decision;
    (req as any).chaosStartTime = start;
    (req as any).chaosLogData = logData;

    next(); // Proceed to proxy middleware
});

// Custom Upgrade Handler for WebSockets
const handleUpgrade = async (req: IncomingMessage, socket: any, head: any) => {
    const cfg = await resolveConfig(req);
    if (!cfg) {
        socket.destroy();
        return;
    }
    
    // Attach config
    (req as any).chaosConfig = cfg;
    
    // TODO: Apply Chaos to WS handshake? (Latency/Jitter could go here)
    // For now transparency.
    
    proxy.upgrade(req, socket, head);
};

// Proxy Middleware
const proxy = createProxyMiddleware({
  router: (req) => {
    const cfg = (req as any).chaosConfig as ChaosConfig;
    return cfg.target; // Dynamic target
  },
  pathRewrite: (path, req) => {
    const cfg = (req as any).chaosConfig as ChaosConfig;
    if (path.startsWith(`/proxy/${cfg.id}`)) {
      return path.replace(`/proxy/${cfg.id}`, '') || '/';
    }
    return path;
  },
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  selfHandleResponse: true,
  on: {
    proxyReq: (proxyReq: ClientRequest, req: IncomingMessage, res: ServerResponse) => {
      const decision = (req as any).chaosDecision;
      if (decision && decision.headers) {
        Object.entries(decision.headers).forEach(([k, v]) => {
          proxyReq.setHeader(k, v as string);
        });
      }
      proxyReq.setHeader('X-Chaos-Proxy', 'true');
    },
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      const decision = (req as any).chaosDecision;
      const cfg = (req as any).chaosConfig as ChaosConfig;

      let buffer = responseBuffer;

      // Fuzzing
      if (decision && decision.shouldFuzz && cfg && cfg.rules && cfg.rules.response_fuzzing) {
        try {
          const bodyStr = responseBuffer.toString('utf8');
          const mutated = chaosEngine.fuzzBody(bodyStr, cfg.rules.response_fuzzing.mutation_rate || 0.1);
          buffer = Buffer.from(JSON.stringify(mutated));
          res.setHeader('X-Chaos-Proxy-Fuzzed', 'true');
        } catch (e) {
          // Fuzz failed
        }
      }

      // Metrics & Logging
      const start = (req as any).chaosStartTime;
      const logData = (req as any).chaosLogData as RequestLog;

      if (start && logData && cfg) {
        const duration = Date.now() - start;
        requestCounter.inc({
          config_id: cfg.id,
          status_code: res.statusCode,
          chaos_type: decision.shouldFuzz ? 'fuzzing' : (decision.shouldLatency ? 'latency' : 'none')
        });
        latencyHistogram.observe({
          config_id: cfg.id,
          chaos_type: decision.shouldFuzz ? 'fuzzing' : (decision.shouldLatency ? 'latency' : 'none')
        }, duration / 1000);

        logData.status_code = res.statusCode;
        logData.duration_ms = duration;
        redisService.logRequest(logData).catch(console.error);
      }
      return buffer;
    }),
    proxyReqWs: (proxyReq: ClientRequest, req: IncomingMessage, socket: any, options: any, head: any) => {
      // WS Handshake manipulation could happen here
      console.log('🌪️ WS Connection Upgrade');
      // Add header specific for WS if needed
      proxyReq.setHeader('X-Chaos-Proxy-WS', 'true');
    }
  }
});

// Use proxy for everything else
app.use('/', proxy);

// Export app, proxy, and handler for testing
export { app, proxy, handleUpgrade };

if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log(`🌪️ Chaos Proxy (Titanium Edition/Node) running on port ${config.port}`);
  });

  // Explicitly handle upgrade for WebSockets
  server.on('upgrade', handleUpgrade);
}

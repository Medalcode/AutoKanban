import express from 'express';
import { IncomingMessage } from 'http';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import promClient from 'prom-client';
import path from 'path';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { chaosProxyService } from './container';
import { config } from './config'; // Assuming src/config/index.ts exports 'config'
import apiRouter from './api/routes/apiRoutes';

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

// Static UI
app.use('/dashboard', express.static(path.join(__dirname, '../web')));

// Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chaos API Proxy Control Plane',
      version: '1.0.0',
      description: 'API for managing chaos configurations and rules.',
    },
    servers: [{ url: `http://localhost:${config.port}`, description: 'Local Server' }],
  },
  apis: ['./src/api/controllers/*.ts', './src/server.ts'], 
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/v1', express.json(), apiRouter);
app.use('/rules', express.json(), apiRouter); // Alias

// Metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Chaos Middleware Logic
// We use a custom middleware to resolve config and decide chaos BEFORE the proxy middleware
const chaosMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip API, Metrics, Dashboard
    if (req.path.startsWith('/api/') || req.path.startsWith('/dashboard') || req.path.startsWith('/metrics') || req.path.startsWith('/api-docs')) {
        return next();
    }

    const start = Date.now();
    
    // 1. Resolve Config
    const configId = await chaosProxyService.resolveConfigString(req.url, req.headers);
    if (!configId) {
        return res.status(404).send('Chaos Proxy: Missing Config ID'); // or pass to next() if we want to allow non-proxied traffic?
    }

    const cfg = await chaosProxyService.getConfig(configId);
    if (!cfg || !cfg.enabled) {
        return res.status(404).send('Chaos Proxy: Config Not Found or Disabled');
    }

    // 2. Rate Limit
    const allowed = await chaosProxyService.checkRateLimit(cfg);
    if (!allowed) {
        return res.status(429).send('Too Many Requests');
    }

    // 3. Make Decision
    const decision = chaosProxyService.decideChaos(cfg, req);
    
    // Attach context
    (req as any).chaosConfig = cfg;
    (req as any).chaosDecision = decision;
    (req as any).chaosStartTime = start;

    // 4. Immediate Actions
    // Error
    if (decision.shouldError) {
        chaosProxyService.logRequest(cfg.id, { method: req.method, originalUrl: req.originalUrl }, {
            statusCode: decision.errorCode,
            duration: Date.now() - start,
            type: 'error'
        });
        requestCounter.inc({ config_id: cfg.id, status_code: decision.errorCode, chaos_type: 'error' });
        
        for (const [k, v] of Object.entries(decision.headers)) res.set(k, v);
        return res.status(decision.errorCode).send(decision.errorBody);
    }

    // Latency
    if (decision.shouldLatency) {
        // We await here. Node handles concurrently fine.
        await new Promise(r => setTimeout(r, decision.latencyMs));
    }

    next();
};

app.use(chaosMiddleware);

// Proxy Definition
const proxy = createProxyMiddleware({
  router: (req) => {
    const cfg = (req as any).chaosConfig;
    return cfg ? cfg.target : 'http://localhost'; // Fallback to avoid crash if middleware skipped incorrectly
  },
  pathRewrite: (path, req) => {
    const cfg = (req as any).chaosConfig;
    if (cfg && path.startsWith(`/proxy/${cfg.id}`)) {
      return path.replace(`/proxy/${cfg.id}`, '') || '/';
    }
    return path;
  },
  changeOrigin: true,
  ws: true, // we will handle upgrades manually to ensure context
  selfHandleResponse: true,
  on: {
    proxyReq: (proxyReq, req, res) => {
      const decision = (req as any).chaosDecision;
      if (decision && decision.headers) {
        Object.entries(decision.headers).forEach(([k, v]) => {
          proxyReq.setHeader(k, v as string);
        });
      }
      proxyReq.setHeader('X-Chaos-Proxy', 'true');
    },
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req: IncomingMessage, res) => {
      const decision = (req as any).chaosDecision;
      const cfg = (req as any).chaosConfig;
      
      // If we somehow got here without config (shouldn't happen due to middleware)
      if (!cfg) return responseBuffer;

      let buffer = responseBuffer;

      // Fuzzing
      if (decision && decision.shouldFuzz && cfg.rules.response_fuzzing) {
        try {
          const bodyStr = responseBuffer.toString('utf8');
          const mutated = chaosProxyService.fuzzBody(bodyStr, cfg.rules.response_fuzzing.mutation_rate || 0.1);
          buffer = Buffer.from(JSON.stringify(mutated));
          res.setHeader('X-Chaos-Proxy-Fuzzed', 'true');
        } catch (e) {
          // Fuzz failed
        }
      }

      // Logging & Metrics
      const start = (req as any).chaosStartTime;
      const duration = Date.now() - start;
      const chaosType = decision.shouldFuzz ? 'fuzzing' : (decision.shouldLatency ? 'latency' : 'none');

      requestCounter.inc({
        config_id: cfg.id,
        status_code: res.statusCode,
        chaos_type: chaosType
      });
      latencyHistogram.observe({
        config_id: cfg.id,
        chaos_type: chaosType
      }, duration / 1000);

      chaosProxyService.logRequest(cfg.id, { method: req.method || 'GET', originalUrl: req.url || '/' }, {
        statusCode: res.statusCode,
        duration: duration,
        type: chaosType
      });

      return buffer;
    })
  }
});

app.use('/', proxy);

// Custom WebSocket Upgrade Handler
const handleUpgrade = async (req: IncomingMessage, socket: any, head: any) => {
    // We need to resolve config manually here as express middleware chain doesn't run on upgrade
    const configId = await chaosProxyService.resolveConfigString(req.url || '', req.headers);
    if (!configId) {
        socket.destroy();
        return;
    }
    const cfg = await chaosProxyService.getConfig(configId);
    if (!cfg || !cfg.enabled) {
        socket.destroy();
        return;
    }

    (req as any).chaosConfig = cfg;
    proxy.upgrade(req, socket, head);
};

export { app, proxy, handleUpgrade };

if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log(`🌪️ Chaos Proxy (Scalable Architecture) running on port ${config.port}`);
  });

  server.on('upgrade', handleUpgrade);
}

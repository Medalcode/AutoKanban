import WebSocket from 'ws';
jest.mock('ioredis'); // Auto-mock using src/__mocks__/ioredis.ts

import { startEchoServer, stopEchoServer } from './ws-echo-server';
import { app, proxy, handleUpgrade } from '../server';
import { Server } from 'http';
import { redisService } from '../services/redis';

// Mock Config for WS
const WS_CONFIG_ID = 'ws-test-config';
const WS_TARGET_PORT = 4000;
const PROXY_PORT = 4001;

describe('WebSocket Proxy', () => {
  let proxyServer: Server;

  beforeAll(async () => {
    // 1. Start Echo Server
    await startEchoServer(WS_TARGET_PORT);

    // 2. Setup Chaos Config in Redis
    await redisService.saveConfig({
        id: WS_CONFIG_ID,
        name: 'WS Test',
        target: `http://localhost:${WS_TARGET_PORT}`,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        rules: {}
    });

    // 3. Start Proxy manually for test
    await new Promise<void>((resolve) => {
        proxyServer = app.listen(PROXY_PORT, () => {
            // Attach upgrade handler
            proxyServer.on('upgrade', handleUpgrade); 
            resolve();
        });
    });
  });

  afterAll(async () => {
    console.log('Test: Stopping proxy server...');
    if (proxyServer) proxyServer.close();
    console.log('Test: Stopping echo server...');
    await stopEchoServer();
    console.log('Test: Quitting redis...');
    await redisService.quit();
    console.log('Test: Cleanup done.');
  }, 10000);

  it('should echo message via proxy', async () => {
    console.log('Test: Connecting to proxy...');
    // Connect to Proxy
    const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/proxy/${WS_CONFIG_ID}`);

    const result = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
            console.log('Test: Timeout fired');
            ws.terminate();
            reject(new Error('Timeout waiting for message'));
        }, 5000);

        ws.on('open', () => {
            console.log('Test: WS Open, sending message...');
            ws.send('Hello Chaos');
        });

        ws.on('message', (data) => {
            console.log('Test: Message received:', data.toString());
            clearTimeout(timer);
            resolve(data.toString());
            ws.close();
        });

        ws.on('error', (err) => {
            console.error('Test: WS Error:', err);
            clearTimeout(timer);
            reject(err);
        });
    });

    expect(result).toBe('Hello Chaos');
  }, 10000); // 10s timeout for this test
});

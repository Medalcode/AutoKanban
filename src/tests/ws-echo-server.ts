import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    // Echo back
    ws.send(message.toString());
  });
});

export const startEchoServer = (port: number) => {
    return new Promise<void>((resolve) => {
        server.listen(port, () => {
             resolve();
        });
    });
};

export const stopEchoServer = () => {
    return new Promise<void>((resolve, reject) => {
        // Close all clients
        wss.clients.forEach(client => client.terminate());
        wss.close(() => {
            server.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
};

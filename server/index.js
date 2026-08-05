import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import app from './app.js';
import config from './config.js';
import { processMessage } from './ai/llm-client.js';
import { startBot } from './telegram/bot.js';
import { startCaspianBot } from './caspian/bot.js';

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// WebSocket Heartbeat / Stale Connection Purge
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Prevent socket errors from crashing the Node.js process
  ws.on('error', (err) => {
    console.error('WebSocket connection error:', err.message);
  });

  const abortController = new AbortController();

  ws.on('message', async (data) => {
    try {
      const payload = JSON.parse(data);
      if (!payload || !payload.message) return;

      await processMessage(
        payload.conversationId,
        payload.message,
        payload.context,
        (chunk) => {
          if (ws.readyState === 1) { // OPEN
            ws.send(JSON.stringify({ type: 'chunk', data: chunk }));
          }
        },
        null, null, null, null,
        abortController.signal
      );
    } catch (err) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    }
  });

  ws.on('close', () => {
    abortController.abort();
    console.log('🔌 WebSocket client disconnected');
  });
});

const PORT = config.port || config.server?.port || 1337;
server.listen(PORT, () => {
  console.log(`🚀 PHANTOM Server running on port ${PORT}`);
  startBot();
  startCaspianBot();
});

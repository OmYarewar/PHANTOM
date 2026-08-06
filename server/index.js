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
    try {
      ws.ping();
    } catch (err) {
      // Ignore ping send errors on closing sockets
    }
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
    console.warn('[WebSocket] Connection error:', err.message);
  });

  const abortController = new AbortController();

  ws.on('message', async (data) => {
    try {
      const payload = JSON.parse(data);
      if (payload?.type === 'ping') {
        ws.isAlive = true;
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
        return;
      }
      if (payload?.type === 'pong') {
        ws.isAlive = true;
        return;
      }
      if (!payload || !payload.message) return;

      const conversationId = payload.conversationId;

      // 1. Notify frontend response start
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'response_start', conversationId }));
      }

      await processMessage(
        conversationId,
        payload.message,
        payload.context,
        // onChunk
        (chunk) => {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'chunk', content: chunk, data: chunk, conversationId }));
          }
        },
        // onToolCall
        (toolCall) => {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'tool_call', ...toolCall, conversationId }));
          }
        },
        // onToolResult
        (toolResult) => {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'tool_result', ...toolResult, conversationId }));
          }
        },
        // onError
        (errorMsg) => {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'error', message: errorMsg, conversationId }));
          }
        },
        // onThinking
        (thinkingText) => {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'thinking', content: thinkingText, conversationId }));
          }
        },
        abortController.signal,
        // onToolProgress
        (progress) => {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'tool_progress', ...progress, conversationId }));
          }
        }
      );

      // 2. Notify frontend response complete
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'response_end', conversationId }));
      }
    } catch (err) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    }
  });

  ws.on('close', () => {
    abortController.abort();
  });
});

const PORT = config.port || config.server?.port || 1337;
server.listen(PORT, () => {
  console.log(`🚀 PHANTOM Server running on port ${PORT}`);
  startBot();
  startCaspianBot();
});

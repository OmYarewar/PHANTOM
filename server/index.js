import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

import config, { loadPersistedSettings } from './config.js';
import { initDB, closeDB, createConversation, getMessages, updateConversationTitle, getSetting } from './memory/store.js';
import { processMessage } from './ai/llm-client.js';
import apiRouter from './routes/api.js';
import { startBot } from './telegram/bot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Initialize database
initDB();

// Load persisted settings from DB (API keys, workspace, etc.)
loadPersistedSettings(getSetting);

// Create Express app
import app from "./app.js";

// API routes

// Serve frontend

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('🔌 Client connected');

  // Track abort controller per connection for stop functionality
  let currentAbortController = null;

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'chat': {
          let conversationId = msg.conversationId;

          // Create new conversation if needed
          if (!conversationId) {
            const conv = createConversation('New Conversation');
            conversationId = conv.id;
            ws.send(JSON.stringify({ type: 'conversation_created', conversationId }));
          }

          // Create a new AbortController for this request
          currentAbortController = new AbortController();
          const abortSignal = currentAbortController.signal;

          // Signal start of response
          ws.send(JSON.stringify({ type: 'response_start', conversationId }));

          await processMessage(
            conversationId,
            msg.content,
            // onChunk — stream text
            (chunk) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'chunk', content: chunk, conversationId }));
              }
            },
            // onToolCall — tool being called
            (toolCall) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'tool_call', ...toolCall, conversationId }));
              }
            },
            // onToolResult — tool result
            (toolResult) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'tool_result', ...toolResult, conversationId }));
              }
            },
            // onError
            (error) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: error, conversationId }));
              }
            },
            // onThinking — AI reasoning/thinking tokens
            (thinkingChunk) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'thinking', content: thinkingChunk, conversationId }));
              }
            },
            // abortSignal
            abortSignal,
            // onToolProgress — live tool output streaming
            (progress) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'tool_progress', ...progress, conversationId }));
              }
            }
          );

          currentAbortController = null;

          // Auto-generate title from first message
          const messages = getMessages(conversationId);
          const userMsgs = messages.filter(m => m.role === 'user');
          if (userMsgs.length === 1) {
            const title = userMsgs[0].content.substring(0, 60) + (userMsgs[0].content.length > 60 ? '...' : '');
            updateConversationTitle(conversationId, title);
            ws.send(JSON.stringify({ type: 'title_updated', conversationId, title }));
          }

          // Signal end of response
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'response_end', conversationId }));
          }
          break;
        }

        case 'stop': {
          // Abort the current operation
          if (currentAbortController) {
            console.log('⏹ Stop requested by user');
            currentAbortController.abort();
            currentAbortController = null;
          }
          break;
        }

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
      }
    } catch (err) {
      console.error('WebSocket error:', err);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected');
    // Abort any running operation when client disconnects
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
  });
});

// Start server
server.listen(config.port, () => {
  startBot();
  console.log(`
╔══════════════════════════════════════════════╗
║                                              ║
║     ██████╗ ██╗  ██╗ █████╗ ███╗   ██╗      ║
║     ██╔══██╗██║  ██║██╔══██╗████╗  ██║      ║
║     ██████╔╝███████║███████║██╔██╗ ██║      ║
║     ██╔═══╝ ██╔══██║██╔══██║██║╚██╗██║      ║
║     ██║     ██║  ██║██║  ██║██║ ╚████║      ║
║     ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝      ║
║            ████████╗ ██████╗ ███╗   ███╗     ║
║            ╚══██╔══╝██╔═══██╗████╗ ████║     ║
║               ██║   ██║   ██║██╔████╔██║     ║
║               ██║   ██║   ██║██║╚██╔╝██║     ║
║               ██║   ╚██████╔╝██║ ╚═╝ ██║     ║
║               ╚═╝    ╚═════╝ ╚═╝     ╚═╝     ║
║                                              ║
║   AI-Powered Pentesting Command Center       ║
║   🌐 http://localhost:${String(config.port).padEnd(24)}║
║   ⚡ WebSocket: ws://localhost:${String(config.port).padEnd(14)}║
║   🔓 Unlimited Tool Iterations               ║
║                                              ║
╚══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚡ Shutting down PHANTOM...');
  closeDB();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDB();
  server.close();
  process.exit(0);
});

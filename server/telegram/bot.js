import TelegramBot from 'node-telegram-bot-api';
import { processMessage } from '../ai/llm-client.js';
import { startSession, stopSession, getSession, resetSession, getHistory, setActiveTelegramSession, clearActiveTelegramSession } from './session.js';
import config, { updateConfig } from '../config.js';
import { setSetting } from '../memory/store.js';
import { resetClient } from '../ai/llm-client.js';
import { getToolDefinitions } from '../tools/registry.js';
import os from 'os';
import { sendAIReply, sendPlain, sendToolUpdate, sendError } from './sender.js';

let bot = null;
let currentConfig = null;
let lastError = null;

export function startBot(cfg) {
  if (bot) {
    stopBot();
  }

  lastError = null;

  currentConfig = cfg || { token: config.telegram?.botToken, userId: config.telegram?.userId };

  if (!currentConfig.token || !currentConfig.userId) {
    console.log('[Telegram] Skipping — TELEGRAM_BOT_TOKEN or TELEGRAM_USER_ID not set');
    return;
  }

  try {
    bot = new TelegramBot(currentConfig.token, { polling: true });

    bot.on('polling_error', (error) => {
      console.error(`[Telegram] Error: ${error.message}`);
      lastError = error.message;
      if (error.message.includes('EFATAL') || error.message.includes('401') || error.message.includes('404')) {
        // Stop polling on fatal errors like invalid token
        stopBot();
        bot = null; // Mark as not running
      }
    });

    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const allowedUserId = parseInt(currentConfig.userId, 10);

      if (chatId !== allowedUserId) {
        return; // Silently ignore
      }

      setActiveTelegramSession(bot, chatId);

      const text = msg.text || '';

      if (text === '/start') {
        await sendPlain(bot, chatId, '👻 PHANTOM online\nSend me a task and I\'ll handle it autonomously.');
        return;
      }

      if (text === '/stop') {
        const session = getSession();
        if (session.status === 'running') {
          stopSession();
          await sendPlain(bot, chatId, '✅ Task stopped.');
        } else {
          await sendPlain(bot, chatId, 'No task is currently running.');
        }
        return;
      }


      if (text.startsWith('/model')) {
          const parts = text.split(' ');
          if (parts.length < 2) {
              await sendPlain(bot, chatId, 'Usage: /model <model_id>');
              return;
          }
          const newModel = parts[1];
          updateConfig({ model: newModel });
          setSetting('api_model', newModel);
          resetClient();
          await sendPlain(bot, chatId, `✅ Model changed to: ${newModel}`);
          return;
      }

      if (text === '/status') {
          const uptime = os.uptime();
          const tools = getToolDefinitions();
          const status = `**PHANTOM Status**\n\n- **Uptime:** ${Math.floor(uptime)}s\n- **Model:** ${config.api.model}\n- **Tools:** ${tools.length}`;
          await sendAIReply(bot, chatId, status);
          return;
      }

      if (text === '/memory') {
          // get history
          const history = getHistory();
          const recent = history.slice(-5).map(m => `- [${m.role}] ${m.content ? m.content.substring(0, 100) + '...' : 'Tool call/result'}`);
          await sendAIReply(bot, chatId, recent.length > 0 ? recent.join('\n') : 'No recent memory.');
          return;
      }

      if (text === '/newchat' || text === '/new') {
          resetSession();
          await sendPlain(bot, chatId, '🔄 New session started.');
          return;
      }

      // Regular message
      const session = getSession();
      if (session.status === 'running') {
        await sendPlain(bot, chatId, '⏳ Already running a task. Send /stop to cancel.');
        return;
      }

      const activeSession = startSession();
      await sendPlain(bot, chatId, 'Processing...');


      try {
        let aiFullResponse = '';
        let lastTypingTime = 0;
        const sendTyping = () => {
            const now = Date.now();
            if (now - lastTypingTime > 4000) {
                lastTypingTime = now;
                bot.sendChatAction(msg.chat.id, 'typing').catch(()=>{});
            }
        };

        await processMessage(
            activeSession.conversationId,
            text,
            (chunk) => {
                aiFullResponse += chunk;
                sendTyping();
            },
            (toolCall) => {
                sendToolUpdate(bot, chatId, toolCall.name, toolCall.args, 'running');
            },
            (toolResult) => {
                const isError = typeof toolResult.result === 'string' && toolResult.result.startsWith('Error:');
                const status = isError ? 'failed' : 'done';
                sendToolUpdate(bot, chatId, toolResult.name, toolResult.result, status);
            },
            (err) => {
                sendError(bot, chatId, err);
            },
            () => {
                // Throttle typing indicators
                sendTyping();
            },

            activeSession.abortController.signal,
            () => {
                // Ignore tool progress for Telegram to avoid spam
            }
        );

        if (activeSession.status !== 'stopped' && aiFullResponse.trim() !== '') {
            await sendAIReply(bot, chatId, aiFullResponse);
        }
      } catch (err) {
        await sendError(bot, chatId, err.message);
      } finally {
        if(activeSession.status === 'running') {
            activeSession.status = 'idle';
        }
        clearActiveTelegramSession();
      }
    });

    console.log(`[Telegram] Bot started for user ${currentConfig.userId}`);
  } catch (err) {
    console.error('[Telegram] Failed to start bot:', err.message);
    lastError = err.message;
  }
}

export function stopBot() {
  if (bot) {
    try {
      bot.stopPolling();
    } catch {}
    bot = null;
  }
}

export function getBotStatus() {
    return {
        enabled: !!(currentConfig && currentConfig.token && currentConfig.userId),
        running: !!bot,
        userId: currentConfig ? currentConfig.userId : null,
        error: lastError
    };
}

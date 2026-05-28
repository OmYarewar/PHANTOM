import TelegramBot from 'node-telegram-bot-api';
import { processMessage } from '../ai/llm-client.js';
import { startSession, stopSession, getSession, resetSession, getHistory } from './session.js';
import config, { updateConfig } from '../config.js';
import { setSetting } from '../memory/store.js';
import { resetClient } from '../ai/llm-client.js';
import { getToolDefinitions } from '../tools/registry.js';
import os from 'os';

let bot = null;
let currentConfig = null;
let lastError = null;

// Helper to chunk long messages (Telegram limit is 4096)
function splitMessage(text, limit = 4000) {
  const chunks = [];
  let currentChunk = '';
  const lines = text.split('\n');

  for (const line of lines) {
    if ((currentChunk.length + line.length + 1) > limit) {
      chunks.push(currentChunk);
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
}


export async function sendMessage(text) {
  if (!bot || !currentConfig || !currentConfig.userId) return;
  try {
    const chunks = splitMessage(text);
    for (const chunk of chunks) {
      await bot.sendMessage(currentConfig.userId, chunk);
    }
  } catch (err) {
    console.error('[Telegram] Error sending message:', err.message);
  }
}


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

      const text = msg.text || '';

      if (text === '/start') {
        await sendMessage('👻 PHANTOM online. Send me a task.');
        return;
      }

      if (text === '/stop') {
        const session = getSession();
        if (session.status === 'running') {
          stopSession();
          await sendMessage('⏹️ Task stopped.');
        } else {
          await sendMessage('No task is currently running.');
        }
        return;
      }


      if (text.startsWith('/model')) {
          const parts = text.split(' ');
          if (parts.length < 2) {
              await sendMessage('Usage: /model <model_id>');
              return;
          }
          const newModel = parts[1];
          updateConfig({ model: newModel });
          setSetting('api_model', newModel);
          resetClient();
          await sendMessage(`✅ Model changed to: ${newModel}`);
          return;
      }

      if (text === '/status') {
          const uptime = os.uptime();
          const tools = getToolDefinitions();
          await sendMessage(`🤖 Server Status:\n- Uptime: ${Math.floor(uptime / 60)} minutes\n- Model: ${config.api.model}\n- Tools: ${tools.length}`);
          return;
      }

      if (text === '/memory') {
          // get history
          const history = getHistory();
          const recent = history.slice(-5).map(m => `[${m.role}] ${m.content ? m.content.substring(0, 100) + '...' : 'Tool call/result'}`);
          await sendMessage(recent.length > 0 ? recent.join('\n') : 'No recent memory.');
          return;
      }

      if (text === '/newchat') {
          resetSession();
          await sendMessage('🧹 Conversation reset. Send me a new task.');
          return;
      }

      // Regular message
      const session = getSession();
      if (session.status === 'running') {
        await sendMessage('⏳ Already running a task. Send /stop to cancel.');
        return;
      }

      const activeSession = startSession();
      await sendMessage('Processing...');

      try {
        let aiFullResponse = '';
        await processMessage(
            activeSession.conversationId,
            text,
            (chunk) => {
                aiFullResponse += chunk;
            },
            (toolCall) => {
                sendMessage(`⚙️ Tool called: ${toolCall.name}\nArguments: ${JSON.stringify(toolCall.args, null, 2)}`);
            },
            (toolResult) => {
                sendMessage(`✅ Tool finished: ${toolResult.name}\nResult:\n\`\`\`\n${typeof toolResult.result === 'string' ? toolResult.result.substring(0, 1000) : '...'}\n\`\`\``);
            },
            (err) => {
                sendMessage(`❌ Error: ${err}`);
            },
            () => {
                // Ignore thinking chunks for Telegram
            },
            activeSession.abortController.signal,
            () => {
                // Ignore tool progress for Telegram to avoid spam
            }
        );

        if (activeSession.status !== 'stopped' && aiFullResponse.trim() !== '') {
            await sendMessage(aiFullResponse);
        }
      } catch (err) {
        await sendMessage(`❌ Error: ${err.message}`);
      } finally {
        if(activeSession.status === 'running') {
            activeSession.status = 'idle';
        }
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


export async function sendMediaFile(filePath, caption = '') {
  if (!bot || !currentConfig || !currentConfig.userId) return;
  try {
    const ext = filePath.split('.').pop().toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    if (imageExts.includes(ext)) {
      await bot.sendPhoto(currentConfig.userId, filePath, { caption });
    } else {
      await bot.sendDocument(currentConfig.userId, filePath, { caption });
    }
    return `Media sent to Telegram successfully.`;
  } catch (err) {
    console.error('[Telegram] Error sending media:', err.message);
    throw err;
  }
}

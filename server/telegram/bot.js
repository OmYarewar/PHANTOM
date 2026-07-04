process.env.NTBA_FIX_319 = '1';
process.env.NTBA_FIX_350 = '1';
import TelegramBot from 'node-telegram-bot-api';
import { processMessage } from '../ai/llm-client.js';
import { startSession, stopSession, getSession, resetSession, getHistory, setActiveTelegramSession, clearActiveTelegramSession, markSessionBootstrapped } from './session.js';
import { bootstrapSession } from './bootstrap.js';
import config, { updateConfig } from '../config.js';
import { setSetting } from '../memory/store.js';
import { resetClient } from '../ai/llm-client.js';
import { getToolDefinitions } from '../tools/registry.js';
import os from 'os';
import { sendAIReply, sendPlain, sendToolUpdate, sendError } from './sender.js';

let bot = null;
let currentConfig = null;
let lastError = null;


/**
 * Runs once per new session. Loads skills + memory and
 * injects them into the session's system prompt context.
 */
async function bootstrapNewSession(chatId) {
  console.log('[Telegram] Bootstrapping new session — loading skills and memory...');

  const context = await bootstrapSession();

  // Build the enriched system prompt section
  const enrichedContext = `
## YOUR CURRENT CAPABILITIES

### Installed Skills
${context.skillsSummary}

### Memory (what you remember from past sessions)
${context.memorySummary}

Use this context to inform your responses. If the user's task relates to an installed skill, use it. If a memory is relevant to the current task, reference it.
  `.trim();

  // Store this in the session so it gets prepended to the system prompt
  markSessionBootstrapped(chatId, enrichedContext);

  console.log(`[Telegram] Bootstrap complete — ${context.raw.skills.length} skills, ${context.raw.memories.length} memories loaded`);

  const skillCount = context.raw.skills.length;
  const memCount = context.raw.memories.length;
  await sendPlain(
    bot,
    chatId,
    `📦 ${skillCount} skill${skillCount !== 1 ? 's' : ''} · 🧠 ${memCount} memor${memCount !== 1 ? 'ies' : 'y'} loaded`
  );
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

      setActiveTelegramSession(bot, chatId);

      const text = msg.text || '';

      if (text === '/start') {
        await sendPlain(bot, chatId, '👻 PHANTOM online\nSend me a task and I\'ll handle it autonomously.');
        return;
      }

      if (text === '/stop') {
        const session = getSession(chatId);
        if (session.status === 'running') {
          stopSession(chatId);
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
          const history = getHistory(chatId);
          const recent = history.slice(-5).map(m => `- [${m.role}] ${m.content ? m.content.substring(0, 100) + '...' : 'Tool call/result'}`);
          await sendAIReply(bot, chatId, recent.length > 0 ? recent.join('\n') : 'No recent memory.');
          return;
      }

      if (text === '/newchat' || text === '/new') {
          resetSession(chatId);
          await sendPlain(bot, chatId, '🔄 New session started. Skills and memory will reload on your next message.');
          return;
      }

      // Regular message
      const session = getSession(chatId);
      if (session.status === 'running') {
        await sendPlain(bot, chatId, '⏳ Already running a task. Send /stop to cancel.');
        return;
      }

      // Start typing indicator early
      let typingInterval = null;
      async function showTyping() {
        try {
          await bot.sendChatAction(chatId, 'typing');
        } catch (err) {
          console.error('[Telegram] Failed to send typing indicator:', err.message);
        }
      }
      await showTyping();
      typingInterval = setInterval(showTyping, 4000);

      try {
        if (!session.bootstrapped) {
          await bootstrapNewSession(chatId);
        }
      } catch (err) {
         console.error('[Telegram] Bootstrap error:', err.message);
      }

      const activeSession = startSession(chatId);



      try {
        let aiFullResponse = '';






        const toolHandles = {};
        const TOOL_UPDATE_THRESHOLD_MS = 2000;

        try {
          await processMessage(
            activeSession.conversationId,
            text,
            session.systemContext,
            (chunk) => {
                aiFullResponse += chunk;
            },
            (toolCall) => {
                const id = toolCall.id || toolCall.name;
                toolHandles[id] = {
                  startTime: Date.now(),
                  sent: false,
                  timeout: setTimeout(() => {
                    toolHandles[id].sent = true;
                    sendToolUpdate(bot, chatId, toolCall.name, toolCall.args, 'running').catch(()=>{});
                  }, TOOL_UPDATE_THRESHOLD_MS)
                };
            },
            (toolResult) => {
                const id = toolResult.id || toolResult.name;
                const isError = typeof toolResult.result === 'string' && toolResult.result.startsWith('Error:');
                const status = isError ? 'failed' : 'done';
                const handle = toolHandles[id];
                if (handle) {
                  clearTimeout(handle.timeout);
                  const elapsed = Date.now() - handle.startTime;
                  if (elapsed >= TOOL_UPDATE_THRESHOLD_MS) {
                    sendToolUpdate(bot, chatId, toolResult.name, toolResult.result, status).catch(()=>{});
                  }
                  delete toolHandles[id];
                }
            },
            (err) => {
                sendError(bot, chatId, err).catch(()=>{});
            },

            () => {
            },
            activeSession.abortController.signal,
            () => {}
          );
        } finally {
          if (typingInterval) {
            clearInterval(typingInterval);
            typingInterval = null;
          }
        }

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
    } catch (err) {
      console.error('[Telegram] Failed to stop polling:', err.message);
    }
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

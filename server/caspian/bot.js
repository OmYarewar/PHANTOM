import { CommClient } from 'caspian-sdk';
import { processMessage } from '../ai/llm-client.js';
import { startSession, stopSession, getSession, resetSession, getHistory, setActiveTelegramSession, clearActiveTelegramSession, markSessionBootstrapped } from '../telegram/session.js';
import { bootstrapSession } from '../telegram/bootstrap.js';
import config from '../config.js';
import { getToolDefinitions } from '../tools/registry.js';
import os from 'os';

let client = null;
let currentConfig = null;
let lastError = null;
let listeningAbort = null; // Track listen promise

/**
 * Runs once per new session. Loads skills + memory and
 * injects them into the session's system prompt context.
 */
async function bootstrapNewSession(chatId) {
  console.log('[Caspian] Bootstrapping new session — loading skills and memory...');

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

  markSessionBootstrapped(chatId, enrichedContext);

  console.log(`[Caspian] Bootstrap complete — ${context.raw.skills.length} skills, ${context.raw.memories.length} memories loaded`);
}

export function startCaspianBot(cfg) {
  if (client) {
    stopCaspianBot();
  }

  lastError = null;

  currentConfig = cfg || { apiKey: config.caspian?.apiKey };

  if (!currentConfig.apiKey) {
    console.log('[Caspian] Skipping — CASPIAN_API_KEY not set');
    return;
  }

  try {
    client = new CommClient({ apiKey: currentConfig.apiKey });
    console.log('[Caspian] Client initialized');

    client.onMessage(async (msg) => {
        // Use the caspian conversation ID as the chatId for session management
        const chatId = msg.conversationId;
        const text = msg.text || '';

        // Commands
        if (text === '/start') {
          await msg.reply('👻 PHANTOM online via Caspian\nSend me a task and I\'ll handle it autonomously.');
          return;
        }

        if (text === '/stop') {
          const session = getSession(chatId);
          if (session.status === 'running') {
            stopSession(chatId);
            await msg.reply('✅ Task stopped.');
          } else {
            await msg.reply('No task is currently running.');
          }
          return;
        }

        if (text === '/status') {
            const uptime = os.uptime();
            const tools = getToolDefinitions();
            const status = `**PHANTOM Status**\n\n- **Uptime:** ${Math.floor(uptime)}s\n- **Model:** ${config.api.model}\n- **Tools:** ${tools.length}`;
            await msg.reply(status);
            return;
        }

        if (text === '/newchat' || text === '/new') {
            resetSession(chatId);
            await msg.reply('🔄 New session started. Skills and memory will reload on your next message.');
            return;
        }


        // Regular message processing
        const session = getSession(chatId);
        if (session.status === 'running') {
          await msg.reply('⏳ Already running a task. Send /stop to cancel.');
          return;
        }

        try {
          if (!session.bootstrapped) {
            await bootstrapNewSession(chatId);
          }
        } catch (err) {
           console.error('[Caspian] Bootstrap error:', err.message);
        }

        const activeSession = startSession(chatId);

        try {
          let aiFullResponse = '';

          // We don't stream tool updates or typing indicators to caspian yet, but we collect the final response

          await processMessage(
            activeSession.conversationId,
            text,
            session.systemContext,
            (chunk) => {
                aiFullResponse += chunk;
            },
            (toolCall) => {
                // optional: could notify of tool call start
            },
            (toolResult) => {
                // optional: could notify of tool result
            },
            (err) => {
                console.error("[Caspian] Error during processMessage", err);
            },
            () => {
                // flush?
            },
            activeSession.abortController.signal,
            () => {}
          );

          if (activeSession.status !== 'stopped' && aiFullResponse.trim() !== '') {
              await msg.reply(aiFullResponse);
          }
        } catch (err) {
            await msg.reply("❌ Error: " + err.message);
        } finally {
          if(activeSession.status === 'running') {
              activeSession.status = 'idle';
          }
        }
    });

    listeningAbort = new AbortController();
    client.listen({ signal: listeningAbort.signal }).catch(err => {
      if (err.name !== 'AbortError') {
        console.error('[Caspian] Listen error:', err.message);
        lastError = err.message;
      }
    });

    console.log(`[Caspian] Bot listening`);
  } catch (err) {
    console.error('[Caspian] Failed to start bot:', err.message);
    lastError = err.message;
  }
}

export function stopCaspianBot() {
  if (listeningAbort) {
    listeningAbort.abort();
    listeningAbort = null;
  }
  client = null;
}

export function getCaspianBotStatus() {
    return {
        enabled: !!(currentConfig && currentConfig.apiKey),
        running: !!client,
        error: lastError
    };
}

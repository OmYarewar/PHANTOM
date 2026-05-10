import { getToolDefinitions } from '../tools/registry.js';
import { executeTool } from '../tools/executor.js';
import { buildSystemPrompt } from './system-prompt.js';
import { addMessage, getMessages, saveMemory, searchMemories, saveToolResult } from '../memory/store.js';
import config, { updateConfig } from '../config.js';
import OpenAI from 'openai';

let openaiClient = null;

function getClient() {
  if (!openaiClient || openaiClient._baseURL !== config.api.baseUrl) {
    openaiClient = new OpenAI({
      apiKey: config.api.apiKey || 'sk-placeholder',
      baseURL: config.api.baseUrl,
    });
  }
  return openaiClient;
}

export function resetClient() {
  openaiClient = null;
}

/**
 * Process a user message: send to LLM with tools, handle tool calls recursively, stream responses.
 * Now supports:
 *  - Unlimited tool iterations (no cap)
 *  - AbortSignal for stopping mid-operation
 *  - Thinking/reasoning token detection
 *  - Live tool output streaming via onToolProgress
 */
export async function processMessage(conversationId, userMessage, onChunk, onToolCall, onToolResult, onError, onThinking, abortSignal, onToolProgress) {
  // Get conversation history
  const history = getMessages(conversationId);

  // Build messages array
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
  ];

  // Add memory context
  try {
    const relevantMemories = searchMemories(userMessage);
    if (relevantMemories.length > 0) {
      const memoryContext = relevantMemories.map(m => `[${m.category}] ${m.key}: ${m.value}`).join('\n');
      messages.push({
        role: 'system',
        content: `## RELEVANT MEMORIES\n${memoryContext}`,
      });
    }
  } catch {}

  // Add conversation history (limit to last 50 messages to stay in context window)
  // Limit history to last 40 messages to keep context window lean
  const recentHistory = history.slice(-40);
  for (const msg of recentHistory) {
    const m = { role: msg.role, content: msg.content };
    if (msg.tool_calls) m.tool_calls = msg.tool_calls;
    if (msg.tool_call_id) {
      m.tool_call_id = msg.tool_call_id;
      m.role = 'tool';
    }
    if (msg.name) m.name = msg.name;
    messages.push(m);
  }

  // Add the new user message
  messages.push({ role: 'user', content: userMessage });
  addMessage(conversationId, { role: 'user', content: userMessage });

  // Pre-fetch tool definitions once (don't re-fetch every loop iteration)
  const tools = getToolDefinitions();
  const client = getClient();

  // Unlimited tool calling loop — runs until AI stops or abort signal fires
  while (true) {
    // Check if aborted
    if (abortSignal?.aborted) {
      const abortMsg = '[PHANTOM] ⏹ Operation stopped by user.';
      onChunk(abortMsg);
      addMessage(conversationId, { role: 'assistant', content: abortMsg });
      return abortMsg;
    }

    try {
      const response = await client.chat.completions.create({
        model: config.api.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        temperature: config.api.temperature,
        max_tokens: config.api.maxTokens,
        stream: true,
      });

      let fullContent = '';
      let thinkingContent = '';
      let toolCalls = [];
      let isInThinkBlock = false;

      for await (const chunk of response) {
        // Check abort between chunks
        if (abortSignal?.aborted) {
          const abortMsg = '[PHANTOM] ⏹ Operation stopped by user.';
          onChunk(abortMsg);
          addMessage(conversationId, { role: 'assistant', content: abortMsg });
          return abortMsg;
        }

        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        // Handle reasoning/thinking tokens (DeepSeek, Claude, etc.)
        // Some models send reasoning in a separate field
        if (delta.reasoning_content || delta.reasoning) {
          const thinkText = delta.reasoning_content || delta.reasoning;
          thinkingContent += thinkText;
          if (onThinking) onThinking(thinkText);
          continue;
        }

        // Handle text content — detect <think> blocks inline
        if (delta.content) {
          const text = delta.content;

          // Check for <think> block opening
          if (text.includes('<think>')) {
            isInThinkBlock = true;
            const parts = text.split('<think>');
            if (parts[0]) {
              fullContent += parts[0];
              onChunk(parts[0]);
            }
            if (parts[1]) {
              thinkingContent += parts[1];
              if (onThinking) onThinking(parts[1]);
            }
            continue;
          }

          // Check for </think> block closing
          if (text.includes('</think>')) {
            isInThinkBlock = false;
            const parts = text.split('</think>');
            if (parts[0]) {
              thinkingContent += parts[0];
              if (onThinking) onThinking(parts[0]);
            }
            if (parts[1]) {
              fullContent += parts[1];
              onChunk(parts[1]);
            }
            continue;
          }

          // Route to thinking or content
          if (isInThinkBlock) {
            thinkingContent += text;
            if (onThinking) onThinking(text);
          } else {
            fullContent += text;
            onChunk(text);
          }
        }

        // Handle tool calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.index !== undefined) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = {
                  id: tc.id || '',
                  type: 'function',
                  function: { name: '', arguments: '' },
                };
              }
              if (tc.id) toolCalls[tc.index].id = tc.id;
              if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }

        // Check for finish
        if (chunk.choices?.[0]?.finish_reason === 'stop') {
          // Normal completion, save and return
          if (fullContent) {
            addMessage(conversationId, { role: 'assistant', content: fullContent });
          }
          return fullContent;
        }

        if (chunk.choices?.[0]?.finish_reason === 'tool_calls') {
          break; // Process tool calls below
        }
      }

      // If we have tool calls, execute them
      if (toolCalls.length > 0) {
        // Save assistant message with tool calls
        const assistantMsg = { role: 'assistant', content: fullContent || null, tool_calls: toolCalls };
        addMessage(conversationId, assistantMsg);
        messages.push(assistantMsg);

        // Execute each tool call
        for (const tc of toolCalls) {
          if (!tc || !tc.function?.name) continue;

          // Check abort before each tool execution
          if (abortSignal?.aborted) {
            const abortMsg = '[PHANTOM] ⏹ Operation stopped by user.';
            onChunk(abortMsg);
            addMessage(conversationId, { role: 'assistant', content: abortMsg });
            return abortMsg;
          }

          let args = {};
          try {
            args = JSON.parse(tc.function.arguments || '{}');
          } catch (e) {
            args = { raw: tc.function.arguments };
          }

          onToolCall({ id: tc.id, name: tc.function.name, args });

          const startTime = Date.now();
          let result;
          try {
            // Pass onToolProgress for live output streaming
            result = await executeTool(tc.function.name, args, (progressText) => {
              if (onToolProgress) onToolProgress({ id: tc.id, name: tc.function.name, text: progressText });
            });
          } catch (e) {
            result = `Error: ${e.message}`;
          }
          const duration = Date.now() - startTime;

          // Truncate very long results
          const maxResultLen = 15000;
          let truncatedResult = result;
          if (typeof result === 'string' && result.length > maxResultLen) {
            truncatedResult = result.substring(0, maxResultLen) + `\n\n... [truncated, ${result.length - maxResultLen} chars omitted]`;
          }

          onToolResult({ id: tc.id, name: tc.function.name, result: truncatedResult });

          // Save tool result
          saveToolResult(conversationId, tc.function.name, args, truncatedResult, 'success', duration);

          // Add tool result to messages
          const toolMsg = { role: 'tool', content: truncatedResult, tool_call_id: tc.id, name: tc.function.name };
          addMessage(conversationId, toolMsg);
          messages.push(toolMsg);
        }

        // Continue the loop — let the LLM process tool results
        continue;
      }

      // No tool calls and finish_reason was not explicitly 'stop' (stream ended)
      if (fullContent) {
        addMessage(conversationId, { role: 'assistant', content: fullContent });
      }
      return fullContent;

    } catch (error) {
      // If aborted, don't show as error
      if (abortSignal?.aborted) {
        const abortMsg = '[PHANTOM] ⏹ Operation stopped by user.';
        onChunk(abortMsg);
        return abortMsg;
      }
      const errMsg = `LLM Error: ${error.message}`;
      onError(errMsg);
      addMessage(conversationId, { role: 'assistant', content: errMsg });
      return errMsg;
    }
  }
}

/**
 * Test API connection
 */
export async function testConnection() {
  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: config.api.model,
      messages: [{ role: 'user', content: 'Say "PHANTOM online" in exactly 2 words.' }],
      max_tokens: 20,
    });
    return { success: true, message: response.choices[0]?.message?.content || 'Connected', model: config.api.model };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

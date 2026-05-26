import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processMessage, resetClient, getClient } from '../server/ai/llm-client.js';
import { initDB, createConversation } from '../server/memory/store.js';

describe('LLM Client', () => {
  let conversationId;

  beforeEach(() => {
    initDB(':memory:');
    const conv = createConversation('Test Conv');
    conversationId = conv.id;
    resetClient();
  });

  it('processMessage should correctly build messages array and process streaming chunks', async () => {
    const mockChunks = [
      { choices: [{ delta: { content: 'Hello' } }] },
      { choices: [{ delta: { content: ' World' } }] },
      { choices: [{ finish_reason: 'stop' }] }
    ];

    // Async generator for mock response
    async function* mockStream() {
      for (const chunk of mockChunks) {
        yield chunk;
      }
    }

    const mockCreate = vi.fn().mockResolvedValue(mockStream());

    const client = getClient();
    vi.spyOn(Object.getPrototypeOf(client.chat.completions), 'create').mockImplementation(mockCreate);

    const onChunk = vi.fn();
    const onToolCall = vi.fn();
    const onToolResult = vi.fn();
    const onError = vi.fn();

    const result = await processMessage(
      conversationId,
      'Test message',
      onChunk,
      onToolCall,
      onToolResult,
      onError
    );

    expect(result).toBe('Hello World');
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onChunk).toHaveBeenNthCalledWith(2, ' World');

    // Check that messages array was built correctly
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages).toBeInstanceOf(Array);
    expect(callArgs.messages[callArgs.messages.length - 1]).toEqual({ role: 'user', content: 'Test message' });
  });

  it('processMessage should parse tool_use response blocks correctly', async () => {
    const mockChunks = [
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'read_file' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"path": "test.txt"}' } }] } }] },
      { choices: [{ finish_reason: 'tool_calls' }] }
    ];

    async function* mockStream() {
      for (const chunk of mockChunks) {
        yield chunk;
      }
    }

    const mockCreate = vi.fn().mockResolvedValueOnce(mockStream()).mockResolvedValueOnce(
        (async function* () { yield { choices: [{ finish_reason: 'stop', delta: { content: 'Done' } }] }; })()
    );

    const client = getClient();
    vi.spyOn(Object.getPrototypeOf(client.chat.completions), 'create').mockImplementation(mockCreate);

    const onChunk = vi.fn();
    const onToolCall = vi.fn();
    const onToolResult = vi.fn();
    const onError = vi.fn();

    await processMessage(
      conversationId,
      'Read test.txt',
      onChunk,
      onToolCall,
      onToolResult,
      onError
    );

    expect(onToolCall).toHaveBeenCalledTimes(1);
    expect(onToolCall).toHaveBeenCalledWith(expect.objectContaining({
      name: 'read_file',
      args: { path: 'test.txt' }
    }));
  });
});

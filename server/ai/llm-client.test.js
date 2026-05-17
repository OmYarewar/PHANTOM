import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { processMessage, testConnection, resetClient } from './llm-client.js';
import config from '../config.js';
import { initDB, closeDB, createConversation } from '../memory/store.js';

describe('LLM Client Integration', () => {
  before(() => {
    initDB(':memory:');

    // Override config for testing via environment variables to prevent leaking keys
    config.api.baseUrl = process.env.TEST_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';
    config.api.apiKey = process.env.TEST_API_KEY || 'test-key-placeholder';
    config.api.model = process.env.TEST_MODEL_ID || 'nvidia/nemotron-3-super-120b-a12b'; // or qwen/qwen3.5-122b-a10b

    // Reset client so it picks up new config
    resetClient();
  });

  after(() => {
    closeDB();
  });

  test('testConnection should return success with NVIDIA API', async () => {
    const result = await testConnection();
    assert.strictEqual(result.success, true, `Connection failed: ${result.message}`);
    assert.ok(result.message);
  });

  test('processMessage should return a response', async () => {
    const conv = createConversation('Test Conv');

    let fullResponse = '';

    await processMessage(
      conv.id,
      'Hello, just say "Test Passed" and nothing else.',
      (chunk) => { fullResponse += chunk; },
      (toolCall) => {},
      (toolResult) => {},
      (error) => { assert.fail(`LLM Error: ${error}`); },
      (thinking) => {},
      null,
      (progress) => {}
    );

    assert.ok(fullResponse.length > 0, 'Should have received a response');
    assert.match(fullResponse, /Test Passed/i);
  });
});

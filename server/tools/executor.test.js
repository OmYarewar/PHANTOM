import { test, describe } from 'node:test';
import assert from 'node:assert';
import { executeTool } from './executor.js';

describe('Tool Executor Integration', () => {
  test('python_execute should evaluate python code inline', async () => {
    const result = await executeTool('python_execute', { code: 'print("hello integration test")' });
    assert.match(result, /hello integration test/);
  });
});

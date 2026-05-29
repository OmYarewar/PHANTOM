import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeTool } from '../server/tools/executor.js';
import { initDB, closeDB, saveMemory, searchMemories } from '../server/memory/store.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import config from '../server/config.js';

describe('Tools Executor', () => {
  let tempDir;
  let originalWorkspace;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'phantom-test-'));
    originalWorkspace = config.workspace;
    config.workspace = tempDir;
  });

  afterEach(async () => {
    config.workspace = originalWorkspace;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('execute_command should return stdout', async () => {
    const result = await executeTool('execute_command', { command: 'echo "hello phantom"' });
    expect(result).toContain('hello phantom');
  });

  it('read_file and write_file should work correctly', async () => {
    const testFile = join(tempDir, 'test.txt');
    const content = 'Hello world';

    const writeResult = await executeTool('write_file', { path: testFile, content });
    expect(writeResult).toContain('File written successfully');

    const readResult = await executeTool('read_file', { path: testFile });
    expect(readResult).toBe(content);
  });

  it('list_directory should return filenames', async () => {
    const testFile = join(tempDir, 'test1.txt');
    await executeTool('write_file', { path: testFile, content: 'test' });

    const result = await executeTool('list_directory', { path: tempDir });
    expect(result).toContain('test1.txt');
  });
});

describe('Memory Store', () => {
  beforeEach(() => {
    initDB(':memory:');
  });

  afterEach(() => {
    closeDB();
  });

  it('save_memory and recall_memory should round-trip correctly', () => {
    saveMemory('Test', 'test-key', 'test-value');
    const results = searchMemories('test');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe('Test');
    expect(results[0].key).toBe('test-key');
    expect(results[0].value).toBe('test-value');
  });
});

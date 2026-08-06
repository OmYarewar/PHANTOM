import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import { initDB, getDB, closeDB, saveMemory, searchSimilar } from './store.js';

describe('Database Store Initialization', () => {
  after(() => {
    closeDB();
  });

  test('initDB should initialize an in-memory database with correct schema', () => {
    const db = initDB(':memory:');

    // Check tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    const expectedTables = [
      'conversations',
      'messages',
      'memories',
      'settings',
      'mcp_servers',
      'tool_results'
    ];

    for (const table of expectedTables) {
      assert.ok(tables.includes(table), `Table ${table} should exist`);
    }

    // Check indices
    const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(i => i.name);
    const expectedIndices = [
      'idx_messages_conversation',
      'idx_memories_category',
      'idx_memories_key',
      'idx_skill_audit_logs_timestamp'
    ];

    for (const index of expectedIndices) {
      assert.ok(indices.includes(index), `Index ${index} should exist`);
    }
  });

  test('initDB should set foreign_keys pragma', () => {
    const db = initDB(':memory:');

    const foreignKeys = db.pragma('foreign_keys', { simple: true });
    assert.strictEqual(foreignKeys, 1);
  });

  test('getDB should return the database instance', () => {
    initDB(':memory:');
    const db2 = getDB();
    assert.ok(db2, 'getDB should return a truthy database instance proxy');
  });
});

describe('Vector Memory Operations', () => {
  after(() => {
    closeDB();
  });

  test('searchSimilar falls back to keyword match when vectorSearch is disabled or no embeddings', async () => {
    initDB(':memory:');

    // We import config to temporarily disable vectorSearch for the fallback test
    const config = (await import('../config.js')).default;
    const oldEnabled = config.memory.vectorSearch.enabled;
    config.memory.vectorSearch.enabled = false;

    await saveMemory('test_category', 'key1', 'This is a test vector value about cybersecurity');
    await saveMemory('test_category', 'key2', 'Completely unrelated value');

    const results = await searchSimilar('cybersecurity', 5);

    assert.ok(results.length >= 1, 'Should find at least 1 keyword match');
    assert.strictEqual(results[0].key, 'key1', 'First result should be key1');

    // Restore
    config.memory.vectorSearch.enabled = oldEnabled;
  });
});

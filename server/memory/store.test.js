import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import { initDB, getDB, closeDB } from './store.js';

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
      'idx_memories_key'
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
    const db1 = initDB(':memory:');
    const db2 = getDB();
    assert.strictEqual(db1, db2, 'getDB should return the current database instance');
  });
});

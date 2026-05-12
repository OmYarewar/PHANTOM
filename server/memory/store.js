import Database from 'better-sqlite3';
import config from '../config.js';
import { v4 as uuidv4 } from 'uuid';

let db;

export function initDB(dbPath = config.db.path) {
  if (db) db.close();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT 'New Conversation',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      tool_calls TEXT,
      tool_call_id TEXT,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      transport TEXT NOT NULL DEFAULT 'stdio',
      command TEXT,
      args TEXT,
      url TEXT,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tool_results (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      tool_name TEXT NOT NULL,
      input TEXT,
      output TEXT,
      status TEXT DEFAULT 'success',
      duration_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
  `);

  return db;
}

export function getDB() {
  if (!db) initDB();
  return db;
}

// ─── Conversations ───
export function createConversation(title = 'New Conversation') {
  const id = uuidv4();
  getDB().prepare('INSERT INTO conversations (id, title) VALUES (?, ?)').run(id, title);
  return { id, title, created_at: new Date().toISOString() };
}

export function getConversations() {
  return getDB().prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all();
}

export function getConversation(id) {
  return getDB().prepare('SELECT * FROM conversations WHERE id = ?').get(id);
}

export function deleteConversation(id) {
  getDB().prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

export function updateConversationTitle(id, title) {
  getDB().prepare('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(title, id);
}

// ─── Messages ───
export function addMessage(conversationId, { role, content, tool_calls, tool_call_id, name }) {
  const id = uuidv4();
  getDB().prepare(
    'INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id, name) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, conversationId, role, content || null, tool_calls ? JSON.stringify(tool_calls) : null, tool_call_id || null, name || null);

  getDB().prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId);
  return id;
}

export function getMessages(conversationId) {
  const rows = getDB().prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId);
  return rows.map(r => ({
    ...r,
    tool_calls: r.tool_calls ? JSON.parse(r.tool_calls) : undefined,
  }));
}

// ─── Memories ───
export function saveMemory(category, key, value, metadata = {}) {
  const id = uuidv4();
  const existing = getDB().prepare('SELECT id FROM memories WHERE category = ? AND key = ?').get(category, key);
  if (existing) {
    getDB().prepare('UPDATE memories SET value = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(value, JSON.stringify(metadata), existing.id);
    return existing.id;
  }
  getDB().prepare('INSERT INTO memories (id, category, key, value, metadata) VALUES (?, ?, ?, ?, ?)')
    .run(id, category, key, value, JSON.stringify(metadata));
  return id;
}

export function searchMemories(query, category = null) {
  const q = `%${query.toLowerCase()}%`;
  if (category) {
    return getDB().prepare(
      'SELECT * FROM memories WHERE category = ? AND (LOWER(key) LIKE ? OR LOWER(value) LIKE ?) ORDER BY updated_at DESC LIMIT 20'
    ).all(category, q, q);
  }
  return getDB().prepare(
    'SELECT * FROM memories WHERE LOWER(key) LIKE ? OR LOWER(value) LIKE ? ORDER BY updated_at DESC LIMIT 20'
  ).all(q, q);
}

export function getAllMemories(category = null) {
  if (category) {
    return getDB().prepare('SELECT * FROM memories WHERE category = ? ORDER BY updated_at DESC').all(category);
  }
  return getDB().prepare('SELECT * FROM memories ORDER BY updated_at DESC LIMIT 100').all();
}

// ─── Settings ───
export function getSetting(key, defaultValue = null) {
  const row = getDB().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

export function setSetting(key, value) {
  getDB().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

export function getAllSettings() {
  const rows = getDB().prepare('SELECT * FROM settings').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}

// ─── MCP Servers ───
export function getMCPServers() {
  return getDB().prepare('SELECT * FROM mcp_servers ORDER BY created_at DESC').all();
}

export function addMCPServer({ name, transport, command, args, url }) {
  const id = uuidv4();
  getDB().prepare('INSERT INTO mcp_servers (id, name, transport, command, args, url) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, transport || 'stdio', command || null, args ? JSON.stringify(args) : null, url || null);
  return id;
}

export function removeMCPServer(id) {
  getDB().prepare('DELETE FROM mcp_servers WHERE id = ?').run(id);
}

// ─── Tool Results ───
export function saveToolResult(conversationId, toolName, input, output, status, durationMs) {
  const id = uuidv4();
  getDB().prepare(
    'INSERT INTO tool_results (id, conversation_id, tool_name, input, output, status, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, conversationId, toolName, JSON.stringify(input), output, status, durationMs);
  return id;
}

export function closeDB() {
  if (db) db.close();
}

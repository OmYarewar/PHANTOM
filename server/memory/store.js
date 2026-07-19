import Database from 'better-sqlite3';
import config from '../config.js';
import { v4 as uuidv4 } from 'uuid';
import { generateEmbedding } from './embeddings.js';
import { searchSimilarVectors } from './vector-store.js';


export function validateParams(sql, params) {
  const placeholderCount = (sql.match(/\?/g) || []).length;
  const paramCount = Array.isArray(params) ? params.length : 0;
  if (placeholderCount !== paramCount) {
    throw new Error(
      `SQL parameter mismatch: query has ${placeholderCount} placeholder(s) but ${paramCount} value(s) were provided.\nQuery: ${sql}`
    );
  }
}


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
      vector_embedding BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS skill_audit_logs (
      id TEXT PRIMARY KEY,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      skill_name TEXT NOT NULL,
      trust_tier INTEGER NOT NULL,
      inputs TEXT,
      outputs TEXT,
      duration_ms INTEGER
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

    -- ⚡ Bolt: Performance optimization
    -- Added indexes to avoid SQLite 'USE TEMP B-TREE FOR ORDER BY' during common queries
    CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
    CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_skill_audit_logs_timestamp ON skill_audit_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_cat_updated ON memories(category, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mcp_servers_created ON mcp_servers(created_at DESC);

    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(id UNINDEXED, type UNINDEXED, content);

    CREATE TRIGGER IF NOT EXISTS after_message_insert AFTER INSERT ON messages BEGIN
      INSERT INTO search_index(id, type, content) VALUES (new.id, 'message', new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS after_memory_insert AFTER INSERT ON memories BEGIN
      INSERT INTO search_index(id, type, content) VALUES (new.id, 'memory', new.value);
    END;

    CREATE TRIGGER IF NOT EXISTS after_memory_update AFTER UPDATE ON memories BEGIN
      UPDATE search_index SET content = new.value WHERE id = new.id AND type = 'memory';
    END;
  `);

  // Backfill if search_index is empty
  const count = getDB().prepare('SELECT count(*) as count FROM search_index').get();
  if (count.count === 0) {
    db.exec(`
      INSERT INTO search_index (id, type, content)
      SELECT id, 'message', content FROM messages WHERE content IS NOT NULL;

      INSERT INTO search_index (id, type, content)
      SELECT id, 'memory', value FROM memories WHERE value IS NOT NULL;
    `);
  }

  return db;
}


export function getDB() {
  if (!db) initDB();

  // Wrap db in a Proxy to intercept prepare() calls and inject validateParams
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') {
        return function(sql) {
          const stmt = target.prepare(sql);
          return new Proxy(stmt, {
            get(stmtTarget, stmtProp) {
              if (['run', 'get', 'all'].includes(stmtProp)) {
                return function(...args) {
                  validateParams(sql, args);
                  return stmtTarget[stmtProp](...args);
                };
              }
              if (stmtProp === 'each') {
                return function(args, cb) {
                  if (typeof args !== 'function') {
                     validateParams(sql, Array.isArray(args) ? args : [args]);
                  } else {
                     validateParams(sql, []);
                  }
                  return stmtTarget[stmtProp](args, cb);
                };
              }
              // Bind other methods like bind() or plucks() if used
              return typeof stmtTarget[stmtProp] === 'function' ? stmtTarget[stmtProp].bind(stmtTarget) : stmtTarget[stmtProp];
            }
          });
        };
      }
      return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
    }
  });
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
  const rows = getDB().prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC').all(conversationId);
  return rows.map(r => ({
    ...r,
    tool_calls: r.tool_calls ? JSON.parse(r.tool_calls) : undefined,
  }));
}

// ─── Memories ───
export async function saveMemory(category, key, value, metadata = {}) {
  const id = uuidv4();

  let embeddingBuffer = null;
  if (config.memory?.vectorSearch?.enabled) {
    const textToEmbed = `${category} ${key} ${value}`;
    const embedding = await generateEmbedding(textToEmbed);
    if (embedding) {
      embeddingBuffer = Buffer.from(embedding.buffer);
    }
  }

  const existing = getDB().prepare('SELECT id FROM memories WHERE category = ? AND key = ?').get(category, key);
  if (existing) {
    getDB().prepare('UPDATE memories SET value = ?, metadata = ?, vector_embedding = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(value, JSON.stringify(metadata), embeddingBuffer, existing.id);
    return existing.id;
  }
  getDB().prepare('INSERT INTO memories (id, category, key, value, metadata, vector_embedding) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, category, key, value, JSON.stringify(metadata), embeddingBuffer);
  return id;
}

/**
 * Searches memories combining exact match, FTS (if applicable), and vector similarity.
 * @param {string} query - The search query.
 * @param {number} limit - Max results to return.
 * @returns {Promise<Array<Object>>}
 */
export async function searchSimilar(query, limit = 5) {
  let memories = [];
  try {
    memories = getDB().prepare('SELECT id, category, key, value, metadata, vector_embedding FROM memories').all();
  } catch (err) {
    console.error('Error fetching memories for search:', err);
    return [];
  }

  if (config.memory?.vectorSearch?.enabled) {
    const queryVector = await generateEmbedding(query);
    if (queryVector) {
      const similar = searchSimilarVectors(queryVector, memories, limit);
      // Map back to standard return format without raw embeddings
      return similar.map(m => {
        const { vector_embedding, ...rest } = m;
        return rest;
      });
    }
  }

  // Fallback to basic keyword search if vector search fails or is disabled
  const lowerQuery = query.toLowerCase();
  const keywordResults = memories.filter(m =>
    (m.key && m.key.toLowerCase().includes(lowerQuery)) ||
    (m.value && m.value.toLowerCase().includes(lowerQuery))
  );

  return keywordResults.slice(0, limit).map(m => {
    const { vector_embedding, ...rest } = m;
    return rest;
  });
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


export function searchConversations(query) {
  // FTS5 MATCH syntax
  const q = '"' + query.replace(/"/g, '""') + '"';
  const rows = getDB().prepare(`
    SELECT
      si.type,
      si.content as matched_text,
      m.conversation_id,
      m.role,
      c.title as conversation_title,
      m.created_at
    FROM search_index si
    LEFT JOIN messages m ON si.id = m.id AND si.type = 'message'
    LEFT JOIN conversations c ON m.conversation_id = c.id
    WHERE search_index MATCH ? AND si.type = 'message'
    ORDER BY m.created_at DESC
    LIMIT 30
  `).all(q);

  return rows;
}


export async function recallMemory(query, options = {}) {
  const { limit = 10, orderBy = 'relevance' } = options;

  // If no query, return most recent entries
  if (!query || query.trim() === '') {
    return new Promise((resolve, reject) => {
      try {
        const rows = getDB().prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT ?').all(limit);
        resolve(rows || []);
      } catch (err) {
        reject(err);
      }
    });
  }

  // FTS5 MATCH syntax for search
  return new Promise((resolve, reject) => {
    try {
      const q = '"' + query.replace(/"/g, '""') + '"';
      const rows = getDB().prepare(`
        SELECT
          si.type,
          si.content as matched_text,
          m.*
        FROM search_index si
        JOIN memories m ON si.id = m.id AND si.type = 'memory'
        WHERE search_index MATCH ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `).all(q, limit);
      resolve(rows || []);
    } catch (err) {
      reject(err);
    }
  });
}

import { describe, it, expect, beforeEach } from 'vitest';
import { validateParams, initDB, getDB, saveMemory, hybridSearchMemories, getMemoryStats } from '../server/memory/store.js';

describe('AgentMemory Engine (rohitg00/agentmemory pattern)', () => {
  beforeEach(() => {
    initDB();
    getDB().prepare('DELETE FROM memories').run();
  });

  describe('validateParams()', () => {
    it('throws clear error on parameter count mismatch', () => {
      expect(() => validateParams('SELECT * FROM t WHERE a=? AND b=?', ['only_one']))
        .toThrow('SQL parameter mismatch');
    });

    it('passes when parameter count matches', () => {
      expect(() => validateParams('SELECT * FROM t WHERE a=? AND b=?', ['one', 'two']))
        .not.toThrow();
    });
  });

  describe('saveMemory & 4-Tier Taxonomy', () => {
    it('saves and updates memory with importance rating', async () => {
      const id = await saveMemory('semantic', 'arch_pattern', 'Use modular microservices', {}, 5);
      expect(id).toBeDefined();

      const stats = getMemoryStats();
      expect(stats.total_memories).toBe(1);
      expect(stats.categories.semantic).toBe(1);
    });

    it('upserts existing key without creating duplicate entries', async () => {
      await saveMemory('semantic', 'db_type', 'SQLite', {}, 3);
      await saveMemory('semantic', 'db_type', 'Better-SQLite3', {}, 4);

      const stats = getMemoryStats();
      expect(stats.total_memories).toBe(1);

      const results = await hybridSearchMemories('Better-SQLite3');
      expect(results.length).toBe(1);
      expect(results[0].value).toBe('Better-SQLite3');
    });
  });

  describe('hybridSearchMemories()', () => {
    it('ranks relevant memories by hybrid keyword + importance + access frequency', async () => {
      await saveMemory('procedural', 'deploy_script', 'Run npm run build and docker push', {}, 4);
      await saveMemory('episodic', 'bug_fix', 'Fixed memory leak in server/memory/store.js', {}, 5);
      await saveMemory('note', 'random_note', 'Remember to buy groceries', {}, 1);

      const results = await hybridSearchMemories('memory leak');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe('bug_fix');
      expect(results[0].access_count).toBeGreaterThanOrEqual(1);
    });

    it('filters by category when specified', async () => {
      await saveMemory('semantic', 'config_val', 'port=3000', {}, 3);
      await saveMemory('episodic', 'session_log', 'User asked about port=3000', {}, 2);

      const results = await hybridSearchMemories('port', 'semantic');
      expect(results.length).toBe(1);
      expect(results[0].category).toBe('semantic');
    });
  });

  describe('getMemoryStats()', () => {
    it('returns structured memory breakdown and top accessed records', async () => {
      await saveMemory('target', 'ip_range', '192.168.1.0/24', {}, 4);
      await saveMemory('credential', 'root_pass', 'secret123', {}, 5);

      const stats = getMemoryStats();
      expect(stats.total_memories).toBe(2);
      expect(stats.categories.target).toBe(1);
      expect(stats.categories.credential).toBe(1);
    });
  });
});

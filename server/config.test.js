import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import config, { updateConfig, loadPersistedSettings } from './config.js';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

describe('Config', () => {
  test('should load default configuration', () => {
    assert.strictEqual(typeof config.port, 'number');
    assert.strictEqual(typeof config.api.baseUrl, 'string');
    assert.strictEqual(typeof config.workspace, 'string');
    assert.strictEqual(typeof config.db.path, 'string');
  });

  test('updateConfig should update values', () => {
    const originalUrl = config.api.baseUrl;
    updateConfig({ baseUrl: 'https://test.api/v1' });
    assert.strictEqual(config.api.baseUrl, 'https://test.api/v1');
    updateConfig({ baseUrl: originalUrl }); // revert
  });

  test('loadPersistedSettings should apply settings and create workspace', () => {
    const mockGetSetting = (key) => {
      if (key === 'api_base_url') return 'https://mock.api/v1';
      if (key === 'workspace') return join(config.root, 'test_workspace_dir');
      return null;
    };

    loadPersistedSettings(mockGetSetting);

    assert.strictEqual(config.api.baseUrl, 'https://mock.api/v1');
    assert.strictEqual(config.workspace, join(config.root, 'test_workspace_dir'));
    assert.ok(existsSync(config.workspace), 'Workspace directory should be created');

    // cleanup
    rmSync(config.workspace, { recursive: true, force: true });
  });
});

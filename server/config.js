import dotenv from 'dotenv';
import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const envPath = join(ROOT, '.env');
const envExamplePath = join(ROOT, '.env.example');

if (!existsSync(envPath) && existsSync(envExamplePath)) {
  copyFileSync(envExamplePath, envPath);
}

dotenv.config({ path: envPath });

const config = {
  root: ROOT,
  port: parseInt(process.env.PORT || '1337', 10),
  workspace: process.env.WORKSPACE_DIR || join(ROOT, 'workspace'),
  db: {
    path: process.env.DB_PATH || join(ROOT, 'data', 'phantom.db')
  },
  api: {
    baseUrl: process.env.API_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.API_KEY || '',
    model: process.env.API_MODEL || 'gpt-4o',
    provider: process.env.API_PROVIDER || 'openai'
  },
  server: {
    port: parseInt(process.env.PORT || '1337', 10)
  }
};

// Ensure workspace directory exists safely
try {
  if (!existsSync(config.workspace)) {
    mkdirSync(config.workspace, { recursive: true });
  }
} catch {
  // Ignore permission errors in restricted environments
}

/**
 * Update config at runtime (called from settings API)
 */
export function updateConfig(updates) {
  if (updates.baseUrl !== undefined) config.api.baseUrl = updates.baseUrl;
  if (updates.apiKey !== undefined) config.api.apiKey = updates.apiKey;
  if (updates.model !== undefined) config.api.model = updates.model;
  if (updates.provider !== undefined) config.api.provider = updates.provider;
  if (updates.workspace !== undefined) {
    config.workspace = updates.workspace;
    try {
      if (!existsSync(config.workspace)) {
        mkdirSync(config.workspace, { recursive: true });
      }
    } catch {}
  }
}

/**
 * Load persisted settings from DB into config (called after DB init)
 */
export function loadPersistedSettings(getSetting) {
  if (typeof getSetting !== 'function') {
    console.warn('[Config] loadPersistedSettings called without a function — skipping persisted settings load.');
    return;
  }

  const baseUrl = getSetting('api_base_url', null);
  const apiKey = getSetting('api_key', null);
  const model = getSetting('api_model', null);
  const provider = getSetting('api_provider', null);
  const workspace = getSetting('workspace', null);

  if (baseUrl) config.api.baseUrl = baseUrl;
  if (apiKey) config.api.apiKey = apiKey;
  if (model) config.api.model = model;
  if (provider) config.api.provider = provider;
  if (workspace) {
    config.workspace = workspace;
    try {
      if (!existsSync(config.workspace)) {
        mkdirSync(config.workspace, { recursive: true });
      }
    } catch {}
  }
}

export default config;

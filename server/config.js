import dotenv from 'dotenv';
import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load .env if it exists, otherwise copy from example
const envPath = join(ROOT, '.env');
if (!existsSync(envPath)) {
  const examplePath = join(ROOT, '.env.example');
  if (existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
  }
}
dotenv.config({ path: envPath });

const config = {
  port: parseInt(process.env.PORT || '1337', 10),
  api: {
    baseUrl: process.env.API_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.API_KEY || '',
    model: process.env.MODEL_ID || 'gpt-4o',
    temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.MAX_TOKENS || '4096', 10),
  },
  workspace: join(ROOT, 'workspace'),
  db: {
    path: join(ROOT, 'phantom.db'),
  },
  root: ROOT,
};

/**
 * Update config at runtime (called from settings API)
 */
export function updateConfig(updates) {
  if (updates.baseUrl !== undefined) config.api.baseUrl = updates.baseUrl;
  if (updates.apiKey !== undefined) config.api.apiKey = updates.apiKey;
  if (updates.model !== undefined) config.api.model = updates.model;
  if (updates.temperature !== undefined) config.api.temperature = parseFloat(updates.temperature);
  if (updates.maxTokens !== undefined) config.api.maxTokens = parseInt(updates.maxTokens, 10);
  if (updates.workspace !== undefined) config.workspace = updates.workspace;
}

/**
 * Load persisted settings from DB into config (called after DB init)
 */
export function loadPersistedSettings(getSetting) {
  const baseUrl = getSetting('api_base_url', null);
  const apiKey = getSetting('api_key', null);
  const model = getSetting('api_model', null);
  const temperature = getSetting('api_temperature', null);
  const maxTokens = getSetting('api_max_tokens', null);
  const workspace = getSetting('workspace', null);

  if (baseUrl) config.api.baseUrl = baseUrl;
  if (apiKey) config.api.apiKey = apiKey;
  if (model) config.api.model = model;
  if (temperature) config.api.temperature = parseFloat(temperature);
  if (maxTokens) config.api.maxTokens = parseInt(maxTokens, 10);
  if (workspace) config.workspace = workspace;

  // Ensure workspace directory exists
  try {
    if (!existsSync(config.workspace)) {
      mkdirSync(config.workspace, { recursive: true });
    }
  } catch {}

  console.log(`📁 Workspace: ${config.workspace}`);
  console.log(`🤖 Model: ${config.api.model}`);
  console.log(`🔑 API Key: ${config.api.apiKey ? '••••' + config.api.apiKey.slice(-4) : 'Not set'}`);
}

export default config;

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
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    userId: process.env.TELEGRAM_USER_ID ? parseInt(process.env.TELEGRAM_USER_ID, 10) : null,
  },
  db: {
    path: join(ROOT, 'phantom.db'),
  },
  agents: {
    enabled: process.env.AGENTS_ENABLED === 'true' || false,
    plannerModel: process.env.AGENTS_PLANNER_MODEL || 'gpt-4o',
    executorModel: process.env.AGENTS_EXECUTOR_MODEL || 'gpt-4o',
  },
  skills: {
    trustTierDefault: parseInt(process.env.SKILLS_TRUST_TIER_DEFAULT || '3', 10),
  },
  memory: {
    vectorSearch: {
      enabled: process.env.VECTOR_SEARCH_ENABLED !== 'false',
      dimensions: parseInt(process.env.VECTOR_SEARCH_DIMENSIONS || '384', 10),
    }
  },
  systemPrompt: null,
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
  if (updates.telegramBotToken !== undefined) config.telegram.botToken = updates.telegramBotToken;
  if (updates.telegramUserId !== undefined) config.telegram.userId = updates.telegramUserId ? parseInt(updates.telegramUserId, 10) : null;
  if (updates.agentsEnabled !== undefined) config.agents.enabled = updates.agentsEnabled;
  if (updates.agentsPlannerModel !== undefined) config.agents.plannerModel = updates.agentsPlannerModel;
  if (updates.agentsExecutorModel !== undefined) config.agents.executorModel = updates.agentsExecutorModel;
  if (updates.skillsTrustTierDefault !== undefined) config.skills.trustTierDefault = parseInt(updates.skillsTrustTierDefault, 10);
  if (updates.vectorSearchEnabled !== undefined) config.memory.vectorSearch.enabled = updates.vectorSearchEnabled;
  if (updates.vectorSearchDimensions !== undefined) config.memory.vectorSearch.dimensions = parseInt(updates.vectorSearchDimensions, 10);
  if (updates.systemPrompt !== undefined) config.systemPrompt = updates.systemPrompt || null;
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
  const telegramBotToken = getSetting('telegram_bot_token', null);
  const telegramUserId = getSetting('telegram_user_id', null);
  const agentsEnabled = getSetting('agents_enabled', null);
  const agentsPlannerModel = getSetting('agents_planner_model', null);
  const agentsExecutorModel = getSetting('agents_executor_model', null);
  const skillsTrustTierDefault = getSetting('skills_trust_tier_default', null);
  const vectorSearchEnabled = getSetting('vector_search_enabled', null);
  const vectorSearchDimensions = getSetting('vector_search_dimensions', null);
  const systemPrompt = getSetting('system_prompt', null);

  if (baseUrl) config.api.baseUrl = baseUrl;
  if (apiKey) config.api.apiKey = apiKey;
  if (model) config.api.model = model;
  if (temperature) config.api.temperature = parseFloat(temperature);
  if (maxTokens) config.api.maxTokens = parseInt(maxTokens, 10);
  if (workspace) config.workspace = workspace;
  if (telegramBotToken) config.telegram.botToken = telegramBotToken;
  if (telegramUserId) config.telegram.userId = parseInt(telegramUserId, 10);
  if (agentsEnabled !== null) config.agents.enabled = agentsEnabled === 'true';
  if (agentsPlannerModel) config.agents.plannerModel = agentsPlannerModel;
  if (agentsExecutorModel) config.agents.executorModel = agentsExecutorModel;
  if (skillsTrustTierDefault !== null) config.skills.trustTierDefault = parseInt(skillsTrustTierDefault, 10);
  if (vectorSearchEnabled !== null) config.memory.vectorSearch.enabled = vectorSearchEnabled === 'true';
  if (vectorSearchDimensions !== null) config.memory.vectorSearch.dimensions = parseInt(vectorSearchDimensions, 10);
  if (systemPrompt !== null) config.systemPrompt = systemPrompt;

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

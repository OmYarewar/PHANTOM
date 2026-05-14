import { Router } from 'express';
import config, { updateConfig } from '../config.js';
import { resetClient, testConnection, processMessage } from '../ai/llm-client.js';
import {
  createConversation, getConversations, getConversation, deleteConversation,
  updateConversationTitle, getMessages,
  getAllSettings, getSetting, setSetting,
  getAllMemories, searchMemories,
  getMCPServers, addMCPServer, removeMCPServer,
} from '../memory/store.js';
import { getToolDefinitions } from '../tools/registry.js';
import os from 'os';
import { execSync } from 'child_process';
import { readdirSync, statSync, rmSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import multer from 'multer';
import AdmZip from 'adm-zip';

const router = Router();

// Multer for file uploads (skills .zip)
const upload = multer({ dest: '/tmp/phantom-uploads/', limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Settings ───
router.get('/settings', (req, res) => {
  const settings = getAllSettings();
  res.json({
    baseUrl: settings.api_base_url || config.api.baseUrl,
    apiKey: settings.api_key ? '••••••••' + settings.api_key.slice(-4) : '',
    apiKeySet: !!settings.api_key || !!config.api.apiKey,
    model: settings.api_model || config.api.model,
    temperature: parseFloat(settings.api_temperature || config.api.temperature),
    maxTokens: parseInt(settings.api_max_tokens || config.api.maxTokens),
    workspace: settings.workspace || config.workspace,
    sudoConfigured: !!settings.sudo_password,
  });
});

router.put('/settings', (req, res) => {
  const { baseUrl, apiKey, model, temperature, maxTokens, sudoPassword, workspace } = req.body;

  if (baseUrl) { setSetting('api_base_url', baseUrl); updateConfig({ baseUrl }); }
  if (apiKey && apiKey !== '••••••••') { setSetting('api_key', apiKey); updateConfig({ apiKey }); }
  if (model) { setSetting('api_model', model); updateConfig({ model }); }
  if (temperature !== undefined) { setSetting('api_temperature', String(temperature)); updateConfig({ temperature }); }
  if (maxTokens !== undefined) { setSetting('api_max_tokens', String(maxTokens)); updateConfig({ maxTokens }); }
  if (sudoPassword !== undefined) { setSetting('sudo_password', sudoPassword); }
  if (workspace) { setSetting('workspace', workspace); updateConfig({ workspace }); }

  resetClient();
  res.json({ success: true, message: 'Settings updated' });
});

router.post('/settings/test', async (req, res) => {
  const result = await testConnection();
  res.json(result);
});

// ─── Conversations ───
router.get('/conversations', (req, res) => {
  res.json(getConversations());
});

router.post('/conversations', (req, res) => {
  const conv = createConversation(req.body.title || 'New Conversation');
  res.json(conv);
});

router.get('/conversations/:id', (req, res) => {
  const conv = getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const messages = getMessages(req.params.id);
  res.json({ ...conv, messages });
});

router.delete('/conversations/:id', (req, res) => {
  deleteConversation(req.params.id);
  res.json({ success: true });
});

router.put('/conversations/:id/title', (req, res) => {
  updateConversationTitle(req.params.id, req.body.title);
  res.json({ success: true });
});

// ─── Tools ───
router.get('/tools', (req, res) => {
  res.json(getToolDefinitions().map(t => ({
    name: t.function.name,
    description: t.function.description,
  })));
});

// ─── Memory ───
router.get('/memory', (req, res) => {
  const { query, category } = req.query;
  if (query) {
    res.json(searchMemories(query, category));
  } else {
    res.json(getAllMemories(category));
  }
});

// ─── MCP Servers ───
router.get('/mcp/servers', (req, res) => {
  res.json(getMCPServers());
});

router.post('/mcp/servers', (req, res) => {
  const id = addMCPServer(req.body);
  res.json({ success: true, id });
});

router.delete('/mcp/servers/:id', (req, res) => {
  removeMCPServer(req.params.id);
  res.json({ success: true });
});

// ─── Sudo Validation ───
router.post('/sudo/validate', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.json({ valid: false, message: 'No password provided' });
  }

  try {
    // Test sudo password by running a harmless command
    const { execSync } = await import('child_process');
    const escapedPass = password.replace(/'/g, "'\\''");
    try {
      execSync(`echo '${escapedPass}' | sudo -S -p '' echo 'phantom_sudo_ok' 2>&1`, {
        encoding: 'utf8',
        timeout: 15000,
      });
      // Password is correct — store it
      setSetting('sudo_password', password);
      res.json({ valid: true, message: 'Sudo access granted ✅' });
    } catch (err) {
      res.json({ valid: false, message: 'Incorrect sudo password' });
    }
  } catch (err) {
    res.json({ valid: false, message: `Validation error: ${err.message}` });
  }
});

// ─── System Info ───
router.get('/system/info', (req, res) => {
  const info = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    user: os.userInfo().username,
    uptime: os.uptime(),
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
    },
    cpus: os.cpus().length,
  };

  try {
    info.distro = execSync('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\'', { encoding: 'utf8' }).trim();
  } catch {}

  try {
    info.ip = execSync("hostname -I 2>/dev/null | awk '{print $1}'", { encoding: 'utf8' }).trim();
  } catch {}

  // Check if sudo password is stored
  info.sudoConfigured = !!getSetting('sudo_password', '');
  info.workspace = config.workspace;

  res.json(info);
});

// ─── Skills Management ───
function getSkillsDir() {
  const dir = join(config.workspace, 'skills');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

router.get('/skills', (req, res) => {
  try {
    const skillsDir = getSkillsDir();
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    const skills = entries.filter(e => e.isDirectory()).map(e => {
      const skillPath = join(skillsDir, e.name);
      let meta = { name: e.name, description: '', files: [] };
      // Try reading a manifest/readme
      try {
        const metaPath = join(skillPath, 'skill.json');
        if (existsSync(metaPath)) {
          meta = { ...meta, ...JSON.parse(readFileSync(metaPath, 'utf8')) };
        }
      } catch {}
      try {
        meta.files = readdirSync(skillPath).slice(0, 20);
      } catch {}
      return meta;
    });
    res.json(skills);
  } catch (err) {
    res.json([]);
  }
});

router.post('/skills/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const skillsDir = getSkillsDir();
    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries();
    // Determine skill name from zip
    const firstDir = entries.find(e => e.isDirectory);
    let skillName = firstDir ? firstDir.entryName.split('/')[0] : req.file.originalname.replace(/\.zip$/i, '');

    // Sanitize skillName to prevent path traversal
    skillName = basename(skillName);
    if (!skillName || skillName === '.' || skillName === '..') {
      return res.status(400).json({ error: 'Invalid skill name' });
    }

    const extractTo = join(skillsDir, skillName);
    if (!existsSync(extractTo)) mkdirSync(extractTo, { recursive: true });
    zip.extractAllTo(extractTo, true);
    // Cleanup temp file
    try { rmSync(req.file.path); } catch {}
    res.json({ success: true, name: skillName, message: `Skill "${skillName}" imported successfully` });
  } catch (err) {
    res.status(500).json({ error: `Failed to import skill: ${err.message}` });
  }
});

router.delete('/skills/:name', (req, res) => {
  try {
    const skillsDir = getSkillsDir();

    // Sanitize the skill name to prevent path traversal vulnerabilities
    const safeName = basename(req.params.name);
    if (!safeName || safeName === '.' || safeName === '..') {
      return res.status(400).json({ error: 'Invalid skill name' });
    }

    const skillPath = join(skillsDir, safeName);
    if (existsSync(skillPath)) {
      rmSync(skillPath, { recursive: true, force: true });
      res.json({ success: true, message: `Skill "${safeName}" deleted` });
    } else {
      res.status(404).json({ error: 'Skill not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── AI Doctor ───
// Uses temporary API credentials — completely separate from main PHANTOM config.
// Uses raw fetch to call any OpenAI-compatible API and pipes the SSE stream to the client.
router.post('/doctor/chat', async (req, res) => {
  const { message, config: doctorCfg, systemPrompt } = req.body;

  if (!doctorCfg?.apiKey) {
    return res.status(400).json({ error: 'API key required' });
  }

  const baseUrl = (doctorCfg.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const apiKey  = doctorCfg.apiKey;
  const model   = doctorCfg.model || 'gpt-4o';

  // Gather live system context using already-imported execSync
  const sysInfo = [];
  try { sysInfo.push('OS: '     + execSync("cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'", { encoding: 'utf8' }).trim()); } catch {}
  try { sysInfo.push('Kernel: ' + execSync('uname -r', { encoding: 'utf8' }).trim()); } catch {}
  try { sysInfo.push('Uptime: ' + execSync('uptime -p', { encoding: 'utf8' }).trim()); } catch {}
  try { sysInfo.push('Disk: '   + execSync('df -h / | tail -1', { encoding: 'utf8' }).trim()); } catch {}
  try { sysInfo.push('Memory: ' + execSync('free -h | head -2 | tail -1', { encoding: 'utf8' }).trim()); } catch {}
  try {
    const failed = execSync('systemctl --failed --no-legend 2>/dev/null | head -10', { encoding: 'utf8' }).trim();
    if (failed) sysInfo.push('Failed services:\n' + failed);
  } catch {}

  const fullSystemPrompt =
    (systemPrompt || 'You are Dr. AI — an expert Linux system administrator and diagnostics AI. Diagnose and fix system issues proactively.') +
    (sysInfo.length ? `\n\n## LIVE SYSTEM STATE\n${sysInfo.join('\n')}` : '');

  const messages = [
    { role: 'system', content: fullSystemPrompt },
    { role: 'user',   content: message },
  ];

  // Send SSE headers immediately
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    // Call OpenAI-compatible API directly via fetch — no SDK, no dynamic import issues
    const apiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      const errContent = `\n\n❌ **API Error ${apiRes.status}**\n\`\`\`\n${errText.substring(0, 400)}\n\`\`\``;
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: errContent } }] })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // Pipe SSE bytes directly from OpenAI API → client (format is already correct)
    const reader = apiRes.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done || req.socket.destroyed) break;
      res.write(decoder.decode(value, { stream: true }));
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('[AI Doctor] Error:', err.message);
    const errContent = `\n\n❌ **Error:** ${err.message}`;
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: errContent } }] })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

export default router;

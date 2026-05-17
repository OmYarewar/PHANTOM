import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { dirname, resolve } from 'path';
import os from 'os';
import { saveMemory, searchMemories } from '../memory/store.js';
import { getSetting } from '../memory/store.js';
import config from '../config.js';

/**
 * Helper to securely escape arguments for bash shell
 */
function escapeShellArg(arg) {
  if (arg === undefined || arg === null) return "''";
  return "'" + String(arg).replace(/'/g, "'\\''") + "'";
}

/**
 * Execute a tool by name with given arguments
 * @param {Function} onProgress - optional callback for live output streaming
 */
export async function executeTool(name, args, onProgress) {
  switch (name) {
    case 'execute_command': return await executeCommand(args, onProgress);
    case 'read_file': return await readFileContent(args);
    case 'write_file': return await writeFileContent(args);
    case 'install_tool': return await installTool(args);
    case 'web_request': return await webRequest(args);
    case 'search_web': return await searchWeb(args);
    case 'scrape_webpage': return await scrapeWebpage(args);
    case 'save_memory': return saveMemoryTool(args);
    case 'recall_memory': return recallMemoryTool(args);
    case 'list_directory': return await listDirectory(args);
    case 'python_execute': return await pythonExecute(args);
    case 'edit_source_code': return await editSourceCode(args);
    case 'save_trace': return await saveTrace(args);
    case 'scrapling_fetch': return await scraplingFetch(args, onProgress);
    case 'show_preview_window': return showPreviewWindow(args);
    default:
      return `Unknown tool: ${name}`;
  }
}

/**
 * Handle show_preview_window execution.
 * Returns a JSON payload so the frontend can intercept and render the HTML.
 */
function showPreviewWindow({ html_content, title }) {
  if (!html_content) {
    throw new Error('html_content is required to show preview window.');
  }
  return JSON.stringify({
    success: true,
    message: `Successfully rendered preview window: "${title || 'Preview'}"`,
    html_content: html_content,
    title: title || 'Preview'
  });
}

// User agent rotation to avoid blocks
const USER_AGENTS = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Execute a shell command with optional live output streaming
 */
async function executeCommand({ command, timeout = 120, working_directory, use_sudo = false }, onProgress) {
  return new Promise((resolvePromise) => {
    let cmd = command;

    const needsSudo = use_sudo || command.trim().startsWith('sudo ');
    if (needsSudo) {
      const sudoPass = getSetting('sudo_password', '');
      if (sudoPass) {
        const cleanCmd = command.trim().startsWith('sudo ') ? command.trim().replace(/^sudo\s+/, '') : command;
        const escaped = sudoPass.replace(/'/g, "'\\''");
        cmd = `echo '${escaped}' | sudo -S -p '' ${cleanCmd} 2>&1`;
      } else {
        cmd = command.trim().startsWith('sudo ') ? command : `sudo ${command}`;
      }
    }

    let cwd = working_directory || config.workspace;
    if (!cwd || !existsSync(cwd)) {
      cwd = os.homedir();
    }
    const proc = spawn('bash', ['-c', cmd], {
      cwd,
      timeout: timeout * 1000,
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (onProgress) onProgress(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString().replace(/\[sudo\] password for.*?:\s*/g, '');
      if (text.trim()) {
        stderr += text;
        if (onProgress) onProgress(text);
      }
    });

    proc.on('close', (code) => {
      let result = '';
      if (stdout) result += stdout;
      if (stderr) result += (result ? '\n' : '') + `[STDERR] ${stderr}`;
      if (code !== 0 && code !== null) result += `\n[EXIT CODE] ${code}`;
      resolvePromise(result || `Command completed with exit code ${code}`);
    });

    proc.on('error', (err) => {
      resolvePromise(`Error executing command: ${err.message}`);
    });

    setTimeout(() => {
      try {
        proc.kill('SIGTERM');
      } catch (err) {
        console.warn(`Failed to kill process: ${err.message}`);
      }
      resolvePromise(stdout + stderr + `\n[TIMEOUT] Command timed out after ${timeout}s`);
    }, timeout * 1000);
  });
}

/**
 * Read file contents
 */
async function readFileContent({ path, max_lines = 500 }) {
  try {
    const resolvedPath = resolve(path);
    const content = await readFile(resolvedPath, 'utf8');
    const lines = content.split('\n');
    if (lines.length > max_lines) {
      return lines.slice(0, max_lines).join('\n') + `\n\n... [truncated at ${max_lines} lines, total ${lines.length} lines]`;
    }
    return content;
  } catch (err) {
    return `Error reading file: ${err.message}`;
  }
}

/**
 * Write file contents
 */
async function writeFileContent({ path: filePath, content, append = false }) {
  try {
    const resolvedPath = resolve(filePath);
    await mkdir(dirname(resolvedPath), { recursive: true });
    if (append) {
      const existing = await readFile(resolvedPath, 'utf8').catch(() => '');
      await writeFile(resolvedPath, existing + content, 'utf8');
    } else {
      await writeFile(resolvedPath, content, 'utf8');
    }
    return `File written successfully: ${resolvedPath}`;
  } catch (err) {
    return `Error writing file: ${err.message}`;
  }
}

/**
 * Install a security tool
 */
async function installTool({ name, method = 'auto', source }) {
  // Detect package manager if auto
  if (method === 'auto') {
    method = detectPackageManager();
  }

  const sudoPass = getSetting('sudo_password', '');
  const sudoPrefix = sudoPass ? `echo '${sudoPass.replace(/'/g, "'\\''")}' | sudo -S` : 'sudo';

  let cmd;
  switch (method) {
    case 'apt':
      cmd = `${sudoPrefix} apt-get install -y ${name}`;
      break;
    case 'pacman':
      cmd = `${sudoPrefix} pacman -S --noconfirm ${name}`;
      break;
    case 'yum':
      cmd = `${sudoPrefix} yum install -y ${name}`;
      break;
    case 'pip':
      cmd = `pip install ${name}`;
      break;
    case 'pipx':
      cmd = `pipx install ${name}`;
      break;
    case 'go':
      cmd = `go install ${source || name}@latest`;
      break;
    case 'cargo':
      cmd = `cargo install ${name}`;
      break;
    case 'npm':
      cmd = `${sudoPrefix} npm install -g ${name}`;
      break;
    case 'git':
      const url = source || `https://github.com/${name}`;
      const repoName = name.split('/').pop();
      cmd = `cd /opt && ${sudoPrefix} git clone ${url} ${repoName} 2>/dev/null || echo "Already cloned"`;
      break;
    case 'snap':
      cmd = `${sudoPrefix} snap install ${name}`;
      break;
    default:
      return `Unknown installation method: ${method}`;
  }

  return await executeCommand({ command: cmd, timeout: 300 });
}

function detectPackageManager() {
  try {
    execSync('which apt-get 2>/dev/null');
    return 'apt';
  } catch {}
  try {
    execSync('which pacman 2>/dev/null');
    return 'pacman';
  } catch {}
  try {
    execSync('which yum 2>/dev/null');
    return 'yum';
  } catch {}
  try {
    execSync('which dnf 2>/dev/null');
    return 'yum';
  } catch {}
  return 'apt'; // default
}

/**
 * Make HTTP requests — enhanced with larger response limits and UA rotation
 */
async function webRequest({ url, method = 'GET', headers = {}, body, follow_redirects = true }) {
  try {
    const opts = {
      method,
      headers: { 'User-Agent': getRandomUA(), ...headers },
      redirect: follow_redirects ? 'follow' : 'manual',
    };
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      opts.body = body;
    }

    const response = await fetch(url, opts);
    const status = response.status;
    const respHeaders = Object.fromEntries(response.headers.entries());
    const text = await response.text();

    let result = `HTTP ${status} ${response.statusText}\n`;
    result += `Headers: ${JSON.stringify(respHeaders, null, 2)}\n\n`;
    // Increased limit from 10KB to 50KB
    const maxLen = 50000;
    result += text.substring(0, maxLen);
    if (text.length > maxLen) result += `\n... [truncated, ${text.length} total chars]`;

    return result;
  } catch (err) {
    return `Request error: ${err.message}`;
  }
}

/**
 * Search the web using DuckDuckGo HTML for better results
 */
async function searchWeb({ query }) {
  try {
    const encoded = encodeURIComponent(query);

    // Try DuckDuckGo HTML (full, not lite)
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      method: 'POST',
      headers: {
        'User-Agent': getRandomUA(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `q=${encoded}`,
    });
    const html = await response.text();

    // Parse results from DuckDuckGo HTML
    const results = [];

    // Extract result links and titles
    const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;

    let match;
    while ((match = resultRegex.exec(html)) !== null) {
      const url = match[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      try {
        results.push({ url: decodeURIComponent(url), title });
      } catch {
        results.push({ url, title });
      }
    }

    let i = 0;
    while ((match = snippetRegex.exec(html)) !== null) {
      const snippet = match[1].replace(/<[^>]+>/g, '').trim();
      if (results[i]) results[i].snippet = snippet;
      i++;
    }

    // Fallback: use curl-based search
    if (results.length === 0) {
      const curlResult = await executeCommand({
        command: `curl -sL "https://html.duckduckgo.com/html/?q=${encoded}" -A "${getRandomUA()}" | grep -oP '(?<=href=")[^"]*uddg=[^"]*' | head -10 | while read url; do echo "$url" | sed 's|.*uddg=||;s|&.*||' | python3 -c "import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))"; done`,
        timeout: 15,
      });
      if (curlResult && curlResult.trim()) {
        return `Search results for "${query}":\n${curlResult}`;
      }
      return `No search results found for "${query}". Try using web_request to search directly or use execute_command with curl.`;
    }

    let output = `Search results for "${query}":\n\n`;
    for (const r of results.slice(0, 10)) {
      output += `• **${r.title || 'No title'}**\n  ${r.url}\n`;
      if (r.snippet) output += `  ${r.snippet}\n`;
      output += '\n';
    }
    return output;
  } catch (err) {
    return `Search error: ${err.message}. Try using execute_command with curl instead.`;
  }
}

/**
 * Scrape a webpage and extract readable text content
 * Strips HTML tags, scripts, styles, and returns clean text
 */
async function scrapeWebpage({ url, max_length = 30000 }) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return `HTTP Error ${response.status}: ${response.statusText}`;
    }

    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();

    // If it's not HTML, return raw text
    if (!contentType.includes('html')) {
      return html.substring(0, max_length);
    }

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'No title';

    // Remove script, style, nav, footer, header, and svg tags and their content
    let text = html.replace(/<(script|style|nav|footer|header|svg)[^>]*>[\s\S]*?<\/\1>/gi, '');

    // Convert common HTML elements to readable format
    text = text.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<li[^>]*>|<\/h[1-6]>|<h[1-6][^>]*>|<\/tr>|<td[^>]*>|<th[^>]*>/gi, (match) => {
      const lower = match.toLowerCase();
      if (lower.startsWith('<br')) return '\n';
      if (lower.startsWith('</p')) return '\n\n';
      if (lower.startsWith('</div') || lower.startsWith('</li') || lower.startsWith('</tr')) return '\n';
      if (lower.startsWith('<li')) return '• ';
      if (lower.startsWith('</h')) return '\n\n';
      if (lower.startsWith('<h')) return '\n## ';
      if (lower.startsWith('<td') || lower.startsWith('<th')) return ' | ';
      return '';
    });

    // Special case for links to keep text and URL
    text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)');

    // Remove all remaining tags
    text = text.replace(/<[^>]+>/g, '');

    // Replace HTML entities in one pass
    const entities = {
      'nbsp': ' ',
      'amp': '&',
      'lt': '<',
      'gt': '>',
      'quot': '"',
      '#39': "'"
    };
    text = text.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m, p1) => entities[p1] || m);

    // Final cleanup
    text = text
      .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
      .replace(/[ \t]+/g, ' ') // Collapse spaces
      .trim();

    let result = `📄 **${title}**\n🔗 ${url}\n\n${text}`;

    if (result.length > max_length) {
      result = result.substring(0, max_length) + `\n\n... [truncated, ${result.length} total chars]`;
    }

    return result;
  } catch (err) {
    return `Scrape error: ${err.message}. Try using execute_command with curl or wget instead.`;
  }
}

/**
 * Save to persistent memory
 */
function saveMemoryTool({ category, key, value }) {
  try {
    saveMemory(category, key, value);
    return `Memory saved: [${category}] ${key}`;
  } catch (err) {
    return `Error saving memory: ${err.message}`;
  }
}

/**
 * Recall from persistent memory
 */
function recallMemoryTool({ query, category }) {
  try {
    const results = searchMemories(query, category);
    if (results.length === 0) return 'No matching memories found.';
    return results.map(m => `[${m.category}] ${m.key}: ${m.value}`).join('\n');
  } catch (err) {
    return `Error searching memory: ${err.message}`;
  }
}

/**
 * List directory contents
 */
async function listDirectory({ path: dirPath, show_hidden = false }) {
  try {
    const resolvedPath = resolve(dirPath);
    const entries = await readdir(resolvedPath, { withFileTypes: true });
    const results = [];

    for (const entry of entries) {
      if (!show_hidden && entry.name.startsWith('.')) continue;
      try {
        const fullPath = resolve(resolvedPath, entry.name);
        const stats = await stat(fullPath);
        const type = entry.isDirectory() ? 'DIR' : 'FILE';
        const size = entry.isFile() ? formatSize(stats.size) : '';
        results.push(`${type.padEnd(5)} ${size.padStart(10)} ${entry.name}`);
      } catch {
        results.push(`???   ${entry.name}`);
      }
    }

    return `Contents of ${resolvedPath}:\n${results.join('\n')}`;
  } catch (err) {
    return `Error listing directory: ${err.message}`;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

/**
 * Execute Python code
 */
async function pythonExecute({ code, timeout = 60 }) {
  return await executeCommand({
    command: `python3 -c ${escapeShellArg(code)}`,
    timeout,
  });
}

/**
 * Edit PHANTOM's own source code — for self-improvement
 */
async function editSourceCode({ file_path, content, description }) {
  try {
    const { writeFile: wf, readFile: rf } = await import('fs/promises');
    const resolvedPath = resolve(file_path);

    // Safety: only allow editing within the project directory
    const projectRoot = resolve(config.root);
    if (!resolvedPath.startsWith(projectRoot)) {
      return `Error: Can only edit files within the project directory (${projectRoot})`;
    }

    // Backup original
    try {
      const original = await rf(resolvedPath, 'utf8');
      const backupDir = join(config.workspace, '.backups');
      const { mkdirSync } = await import('fs');
      try { mkdirSync(backupDir, { recursive: true }); } catch {}
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = resolvedPath.replace(/\//g, '_').slice(1);
      await wf(join(backupDir, `${backupName}.${timestamp}.bak`), original, 'utf8');
    } catch {}

    await wf(resolvedPath, content, 'utf8');
    return `Source file edited: ${resolvedPath}\nDescription: ${description || 'No description'}\nNote: Restart may be needed for changes to take effect.`;
  } catch (err) {
    return `Error editing source: ${err.message}`;
  }
}

/**
 * Save execution trace for self-optimization (Meta-Harness pattern)
 */
async function saveTrace({ task, approach, outcome, score, notes }) {
  try {
    const { writeFile: wf, mkdirSync: mkd } = await import('fs');
    const { writeFile: wfp } = await import('fs/promises');
    const tracesDir = join(config.workspace, '.traces');
    try { mkd(tracesDir, { recursive: true }); } catch {}

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const trace = {
      timestamp: new Date().toISOString(),
      task,
      approach,
      outcome,
      score: score || null,
      notes: notes || '',
    };

    await wfp(join(tracesDir, `trace-${timestamp}.json`), JSON.stringify(trace, null, 2), 'utf8');
    return `Trace saved: ${task} (outcome: ${outcome})`;
  } catch (err) {
    return `Error saving trace: ${err.message}`;
  }
}

/**
 * Scrapling-powered web fetching — bypasses anti-bot, renders JS, extracts data
 */
async function scraplingFetch({ url, mode = 'basic', css_selector, xpath, proxy, solve_cloudflare = true }, onProgress) {
  const bridgePath = resolve(import.meta.dirname, 'scrapling_bridge.py');

  let cmd = `python3 ${escapeShellArg(bridgePath)} ${escapeShellArg(url)} --mode ${escapeShellArg(mode)}`;
  if (css_selector) cmd += ` --css ${escapeShellArg(css_selector)}`;
  if (xpath) cmd += ` --xpath ${escapeShellArg(xpath)}`;
  if (proxy) cmd += ` --proxy ${escapeShellArg(proxy)}`;
  if (!solve_cloudflare) cmd += ` --no-cloudflare`;

  return await executeCommand({ command: cmd, timeout: 60 }, onProgress);
}

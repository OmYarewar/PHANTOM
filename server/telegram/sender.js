import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import telegramifyMarkdown from 'telegramify-markdown';

/**
 * THE CORE FUNCTION — converts any AI markdown output to clean Telegram HTML
 * then sends it in chunks if needed.
 */
export async function sendAIReply(bot, chatId, markdownText) {
  if (!markdownText || markdownText.trim() === '') return;

  const converted = toTelegramMarkdown(markdownText);
  const chunks = splitIntoChunks(converted, 4096);

  // Send first chunk sequentially, rest in parallel to speed up (Bug 4)
  if (chunks.length === 1) {
    try {
      await bot.sendMessage(chatId, chunks[0], {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      });
    } catch (err) {
      console.error('[Telegram] MarkdownV2 failed:', err.message);
      const plain = markdownText
        .replace(/[*_`~\\]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .slice(0, 4096);
      try {
        await bot.sendMessage(chatId, plain);
      } catch (e2) {
        console.error('[Telegram] Plain fallback also failed:', e2.message);
      }
    }
  } else {
    // Send first chunk
    try {
      await bot.sendMessage(chatId, chunks[0], {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      });
    } catch (err) {
      console.error('[Telegram] MarkdownV2 failed (chunk 0):', err.message);
      const plain = markdownText.slice(0, 4096).replace(/[*_`~\\]/g, '').replace(/\n{3,}/g, '\n\n');
      try { await bot.sendMessage(chatId, plain); } catch (e) {
        console.error('[Telegram] Fallback failed:', e.message);
      }
    }

    // Fire the rest in parallel with small delays
    for (let i = 1; i < chunks.length; i++) {
      await new Promise(r => setTimeout(r, 100)); // preserve order
      try {
        await bot.sendMessage(chatId, chunks[i], {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
        });
      } catch (err) {
        console.error('[Telegram] MarkdownV2 failed (chunk ' + i + '):', err.message);
        const plain = markdownText.slice(i*4096, (i+1)*4096).replace(/[*_`~\\]/g, '').replace(/\n{3,}/g, '\n\n');
        try { await bot.sendMessage(chatId, plain); } catch (e) {
          console.error('[Telegram] Fallback failed:', e.message);
        }
      }
    }
  }
}

/**
 * Sends a plain text message — no formatting.
 * Used for status updates, errors, and fallback.
 */
export async function sendPlain(bot, chatId, text) {
  const chunks = splitIntoChunks(String(text), 4096);
  for (const chunk of chunks) {
    try {
      await bot.sendMessage(chatId, chunk);
    } catch (err) {
      console.error('[Telegram] Failed to send plain message:', err.message);
    }
  }
}

/**
 * Sends a tool execution status card.
 * Clean, minimal — shows what tool is running and its status.
 */
export async function sendToolUpdate(bot, chatId, toolName, input, status) {
  const icons = {
    execute_command: '🖥️', read_file: '📄', write_file: '✏️',
    list_directory: '📁', search_web: '🔍', web_request: '🌐',
    save_memory: '🧠', recall_memory: '💭', edit_source_code: '⚙️',
    save_trace: '📋', send_file_to_telegram: '📤',
  };
  const statusMap = { running: '🔄 Running', done: '✅ Done', failed: '❌ Failed' };
  const icon = icons[toolName] || '🔧';
  const statusText = statusMap[status] || status;
  const preview = input ? String(input).slice(0, 60) + (String(input).length > 60 ? '…' : '') : '';

  // Build this as a simple HTML message manually (no conversion needed — we control all content)
  const safeToolName = toolName.replace(/_/g, '\\_');
  const safePreview = preview.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  const msg = `${statusText} ${icon} \`${safeToolName}\`\n${safePreview ? '`' + safePreview + '`' : ''}`;

  try {
    await bot.sendMessage(chatId, msg, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    console.warn('[Telegram] Failed to send tool update as MarkdownV2, falling back to plain text:', err.message);
    await sendPlain(bot, chatId, `${statusText} ${toolName}${preview ? ': ' + preview : ''}`);
  }
}

/**
 * Sends an error message.
 */
export async function sendError(bot, chatId, message) {
  try {
    const safe = String(message).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
    await bot.sendMessage(chatId, `❌ *Error*\n${safe}`, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    console.warn('[Telegram] Failed to send error as MarkdownV2, falling back to plain text:', err.message);
    await sendPlain(bot, chatId, `❌ Error: ${message}`);
  }
}

/**
 * THE FILE SENDER — sends any file from the server filesystem to Telegram.
 */
export async function sendFile(bot, chatId, filePath, caption = '') {
  // Resolve to absolute path
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  // Security check: only allow files from workspace/ or /tmp/
  const workspaceDir = path.resolve(process.cwd(), 'workspace');
  const tmpDir = '/tmp';
  const isInWorkspace = absPath.startsWith(workspaceDir + path.sep) || absPath === workspaceDir;
  const isInTmp = absPath.startsWith(tmpDir + path.sep) || absPath === tmpDir;

  if (!isInWorkspace && !isInTmp) {
    await sendError(bot, chatId, `File access denied: ${filePath}\nOnly files in workspace/ or /tmp/ can be sent.`);
    return { success: false, error: 'Path outside allowed directories' };
  }

  // Check file exists
  if (!fs.existsSync(absPath)) {
    await sendError(bot, chatId, `File not found: ${filePath}`);
    return { success: false, error: 'File not found' };
  }

  // Check file size (Telegram limit: 50MB for most, 2GB for video with streaming)
  const stats = fs.statSync(absPath);
  const maxBytes = 50 * 1024 * 1024; // 50MB
  if (stats.size > maxBytes) {
    await sendError(bot, chatId, `File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB (max 50MB)`);
    return { success: false, error: 'File too large' };
  }

  const ext = path.extname(absPath).toLowerCase();
  const fileName = path.basename(absPath);
  const mimeType = mime.lookup(absPath) || 'application/octet-stream';
  const fileStream = fs.createReadStream(absPath);
  const captionText = caption || fileName;
  const options = { caption: captionText };

  try {
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
      await bot.sendPhoto(chatId, fileStream, options);
    } else if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
      await bot.sendVideo(chatId, fileStream, { ...options, supports_streaming: true });
    } else if (['.mp3', '.m4a', '.wav', '.flac', '.aac'].includes(ext)) {
      await bot.sendAudio(chatId, fileStream, options);
    } else if (ext === '.ogg' && stats.size < 1024 * 1024) {
      await bot.sendVoice(chatId, fileStream, options);
    } else {
      await bot.sendDocument(chatId, fileStream, options, { filename: fileName, contentType: mimeType });
    }
    return { success: true, path: absPath, type: mimeType };
  } catch (err) {
    await sendError(bot, chatId, `Failed to send file: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Splits text at newline boundaries to stay under maxLen.
 */
function splitIntoChunks(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let current = '';
  for (const line of text.split('\n')) {
    if ((current + '\n' + line).length > maxLen) {
      if (current) chunks.push(current.trim());
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 0);
}

/**
 * Scans the converted HTML string and escapes any reserved characters
 * that are still unescaped, but ONLY outside of code blocks and inline code.
 * This is the safety net after telegramify-markdown runs.
 */
export function fixUnescapedChars(text) {
  const result = [];
  let i = 0;
  let inCodeBlock = false;
  let inInlineCode = false;

  while (i < text.length) {
    // Detect code block (```)
    if (text.slice(i, i + 3) === '```') {
      inCodeBlock = !inCodeBlock;
      result.push('```');
      i += 3;
      continue;
    }

    // Detect inline code (`)
    if (text[i] === '`' && !inCodeBlock) {
      inInlineCode = !inInlineCode;
      result.push('`');
      i++;
      continue;
    }

    // Inside code — pass through raw, no escaping
    if (inCodeBlock || inInlineCode) {
      result.push(text[i]);
      i++;
      continue;
    }

    // Outside code — check if reserved char is properly escaped
    const ch = text[i];
    const reserved = '_*[]()~`>#+\\-=|{}.!\\';
    if (reserved.includes(ch)) {
      // Check if already escaped (preceded by \)
      const prevChar = result.length > 0 ? result[result.length - 1] : '';
      if (prevChar !== '\\') {
        result.push('\\');
      }
    }
    result.push(ch);
    i++;
  }

  return result.join('');
}

/**
 * Manual escape — used when telegramify-markdown throws.
 * Strips all markdown formatting and returns safely escaped plain text.
 */
export function manualEscape(text) {
  // Remove markdown formatting
  text = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`{3}[\s\S]*?`{3}/g, (m) => m) // keep code blocks raw
    .replace(/`([^`]+)`/g, (m) => m);        // keep inline code raw

  // Escape all reserved characters
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}


function convertTables(text) {
  if (!text.includes('|')) return text;

  const lines = text.split('\n');
  const result = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      // Skip the separator line (e.g., |---|---|)
      if (line.replace(/[|\-\s:]/g, '').length === 0) continue;

      // Convert table row to bullet points or just clean text
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length > 0) {
        result.push('• ' + cells.join(' : '));
      }
    } else {
      if (inTable) {
        result.push(''); // add a blank line after table
        inTable = false;
      }
      result.push(line);
    }
  }
  return result.join('\n');
}
export function toTelegramMarkdown(text) {
  if (!text || text.trim() === '') return '';

  text = convertTables(text);

  // Step 1: Replace horizontal rules before library processes them
  text = text.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '──────────────────');

  // Step 2: Run telegramify-markdown
  let converted;
  try {
    converted = telegramifyMarkdown(text, 'escape');
  } catch (err) {
    // Library failed — do manual escaping as fallback
    converted = manualEscape(text);
  }

  // Step 3: Nuclear fallback escape — catch anything telegramify-markdown missed
  // Re-scan for unescaped reserved chars OUTSIDE of code spans and code blocks
  // converted = fixUnescapedChars(converted);

  return converted;
}

/**
 * Internet Crawling Tools — Zero-Config Agent Reach Integration
 * 
 * These tools give PHANTOM's AI agent the ability to crawl and read content
 * from across the internet without any API keys, cookies, or configuration.
 * 
 * Inspired by Agent Reach (https://github.com/Panniantong/agent-reach)
 */

import { spawn } from 'child_process';
import { validateUrlForSSRF } from './executor.js';

// ─── Jina Reader: Read any URL as clean Markdown ───

/**
 * Fetches any URL through Jina Reader API and returns clean, readable Markdown.
 * Zero config, free, no API key required.
 */
export async function jinaReadUrl({ url, max_length = 50000 }) {
  try {
    validateUrlForSSRF(url);

    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/markdown',
        'User-Agent': 'PHANTOM/1.0',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return `Error: Jina Reader returned HTTP ${response.status} for ${url}. Try the scrape_webpage tool as a fallback.`;
    }

    const markdown = await response.text();

    if (!markdown || markdown.trim().length === 0) {
      return `Jina Reader returned empty content for ${url}. The page may be behind a login wall or have anti-bot protections. Try scrape_webpage or scrapling_fetch instead.`;
    }

    const trimmed = markdown.length > max_length
      ? markdown.substring(0, max_length) + `\n\n[... truncated at ${max_length} chars. Full content is ${markdown.length} chars.]`
      : markdown;

    return `# Content from ${url}\n\n${trimmed}`;
  } catch (err) {
    return `Error reading URL via Jina Reader: ${err.message}`;
  }
}

// ─── YouTube Search ───

/**
 * Searches YouTube for videos matching a query using yt-dlp.
 * Returns titles, URLs, durations, view counts.
 */
export async function youtubeSearch({ query, max_results = 10 }) {
  try {
    const results = await runCommand('yt-dlp', [
      `ytsearch${max_results}:${query}`,
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      '--quiet',
    ], 30000);

    if (results.error) {
      if (results.error.includes('not found') || results.error.includes('No such file')) {
        return 'Error: yt-dlp is not installed. Install it with: pip install yt-dlp';
      }
      return `YouTube search error: ${results.error}`;
    }

    const lines = results.stdout.trim().split('\n').filter(Boolean);
    const videos = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        videos.push({
          title: data.title || 'Unknown',
          url: data.url ? `https://www.youtube.com/watch?v=${data.id || data.url}` : data.webpage_url || '',
          channel: data.channel || data.uploader || 'Unknown',
          duration: data.duration ? formatDuration(data.duration) : 'N/A',
          views: data.view_count ? formatNumber(data.view_count) : 'N/A',
        });
      } catch {
        // Skip malformed JSON lines
      }
    }

    if (videos.length === 0) {
      return `No YouTube results found for: "${query}"`;
    }

    let output = `# YouTube Search Results for "${query}"\n\n`;
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      output += `${i + 1}. **${v.title}**\n`;
      output += `   Channel: ${v.channel} | Duration: ${v.duration} | Views: ${v.views}\n`;
      output += `   URL: ${v.url}\n\n`;
    }

    return output;
  } catch (err) {
    return `YouTube search error: ${err.message}`;
  }
}

// ─── YouTube Subtitles ───

/**
 * Extracts subtitles/captions from a YouTube video URL using yt-dlp.
 */
export async function youtubeGetSubtitles({ url, language = 'en' }) {
  try {
    // First try auto-generated subtitles, then manual
    const results = await runCommand('yt-dlp', [
      url,
      '--write-auto-sub',
      '--write-sub',
      '--sub-lang', language,
      '--sub-format', 'json3',
      '--skip-download',
      '--print-json',
      '--no-warnings',
      '--quiet',
    ], 45000);

    if (results.error) {
      if (results.error.includes('not found') || results.error.includes('No such file')) {
        return 'Error: yt-dlp is not installed. Install it with: pip install yt-dlp';
      }
      return `YouTube subtitle extraction error: ${results.error}`;
    }

    // Parse video info
    let videoInfo = {};
    try {
      videoInfo = JSON.parse(results.stdout.trim().split('\n').pop());
    } catch {
      // Continue without video info
    }

    const title = videoInfo.title || 'Unknown Video';

    // Try fetching the subtitle text directly via yt-dlp
    const subResults = await runCommand('yt-dlp', [
      url,
      '--write-auto-sub',
      '--write-sub',
      '--sub-lang', language,
      '--sub-format', 'vtt',
      '--skip-download',
      '--print', '%(requested_subtitles)j',
      '--no-warnings',
      '--quiet',
    ], 30000);

    // Fallback: use Jina Reader on YouTube page for transcript
    if (!subResults.stdout || subResults.stdout.trim() === 'null' || subResults.stdout.trim() === '{}') {
      const jinaResult = await jinaReadUrl({ url, max_length: 50000 });
      return `# Subtitles for: ${title}\n\n> Note: No ${language} subtitles file found via yt-dlp. Fetched page content via Jina Reader instead.\n\n${jinaResult}`;
    }

    return `# Subtitles for: ${title}\n\nURL: ${url}\nLanguage: ${language}\n\n${subResults.stdout}`;
  } catch (err) {
    return `YouTube subtitle error: ${err.message}`;
  }
}

// ─── RSS Feed Reader ───

/**
 * Fetches and parses any RSS/Atom feed URL.
 * Returns structured entries with title, link, date, and summary.
 */
export async function rssReadFeed({ url, max_items = 20 }) {
  try {
    validateUrlForSSRF(url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PHANTOM/1.0 RSS Reader',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return `Error: RSS feed returned HTTP ${response.status} for ${url}`;
    }

    const xml = await response.text();

    // Parse RSS/Atom XML manually (no dependency needed)
    const items = [];

    // Try RSS 2.0 format first
    const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    // Try Atom format
    const atomEntries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];

    const entries = rssItems.length > 0 ? rssItems : atomEntries;

    for (const entry of entries.slice(0, max_items)) {
      const titleMatch = entry.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = entry.match(/<link[^>]*href="([^"]*)"[^>]*>/i) || entry.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const dateMatch = entry.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || entry.match(/<published[^>]*>([\s\S]*?)<\/published>/i) || entry.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
      const descMatch = entry.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) || entry.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i) || entry.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i);

      const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
      const link = linkMatch ? linkMatch[1].trim() : '';
      const date = dateMatch ? dateMatch[1].trim() : '';
      let desc = descMatch ? descMatch[1].trim() : '';

      // Strip HTML from description
      desc = desc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      if (desc.length > 300) desc = desc.substring(0, 300) + '...';

      items.push({ title, link, date, description: desc });
    }

    // Get feed title
    const feedTitleMatch = xml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const feedTitle = feedTitleMatch ? feedTitleMatch[1].trim() : url;

    if (items.length === 0) {
      return `No entries found in RSS feed: ${url}. The URL may not be a valid RSS/Atom feed.`;
    }

    let output = `# 📡 RSS Feed: ${feedTitle}\n\nSource: ${url}\nEntries: ${items.length}\n\n---\n\n`;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      output += `### ${i + 1}. ${item.title}\n`;
      if (item.date) output += `📅 ${item.date}\n`;
      if (item.link) output += `🔗 ${item.link}\n`;
      if (item.description) output += `\n${item.description}\n`;
      output += '\n---\n\n';
    }

    return output;
  } catch (err) {
    return `RSS feed error: ${err.message}`;
  }
}

// ─── V2EX Browser ───

/**
 * Browses V2EX tech community using their public JSON API.
 * Zero config, no auth required.
 */
export async function v2exBrowse({ action = 'hot', topic_id, node_name }) {
  try {
    const baseUrl = 'https://www.v2ex.com/api/v2';
    let apiUrl;
    let description;

    switch (action) {
      case 'hot':
        apiUrl = `${baseUrl}/nodes/hot/topics.json`;
        description = 'V2EX Hot Topics';
        // V2EX v2 API may need different endpoints, fallback to v1
        apiUrl = 'https://www.v2ex.com/api/topics/hot.json';
        break;
      case 'latest':
        apiUrl = 'https://www.v2ex.com/api/topics/latest.json';
        description = 'V2EX Latest Topics';
        break;
      case 'topic':
        if (!topic_id) return 'Error: topic_id is required for action "topic"';
        apiUrl = `https://www.v2ex.com/api/topics/show.json?id=${topic_id}`;
        description = `V2EX Topic #${topic_id}`;
        break;
      case 'node':
        if (!node_name) return 'Error: node_name is required for action "node" (e.g., "python", "linux", "jobs")';
        apiUrl = `https://www.v2ex.com/api/topics/show.json?node_name=${encodeURIComponent(node_name)}`;
        description = `V2EX Node: ${node_name}`;
        break;
      default:
        return `Unknown V2EX action: "${action}". Available: hot, latest, topic, node`;
    }

    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'PHANTOM/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return `V2EX API error: HTTP ${response.status}`;
    }

    const data = await response.json();

    if (!Array.isArray(data) && !data.result) {
      // Single topic
      const topics = Array.isArray(data) ? data : [data];
      return formatV2exTopics(description, topics);
    }

    const topics = Array.isArray(data) ? data : (data.result || []);
    return formatV2exTopics(description, topics);
  } catch (err) {
    return `V2EX error: ${err.message}`;
  }
}

function formatV2exTopics(title, topics) {
  if (!topics || topics.length === 0) {
    return `No topics found for: ${title}`;
  }

  let output = `# 💻 ${title}\n\nFound ${topics.length} topics\n\n---\n\n`;

  for (let i = 0; i < Math.min(topics.length, 25); i++) {
    const t = topics[i];
    output += `### ${i + 1}. ${t.title || 'Untitled'}\n`;
    if (t.member) output += `👤 ${t.member.username || 'anonymous'}`;
    if (t.node) output += ` | 📂 ${t.node.title || t.node.name || ''}`;
    if (t.replies !== undefined) output += ` | 💬 ${t.replies} replies`;
    if (t.created) output += ` | 📅 ${new Date(t.created * 1000).toISOString().split('T')[0]}`;
    output += '\n';
    if (t.url) output += `🔗 ${t.url}\n`;
    else if (t.id) output += `🔗 https://www.v2ex.com/t/${t.id}\n`;
    if (t.content_rendered || t.content) {
      let content = (t.content_rendered || t.content || '').replace(/<[^>]+>/g, '');
      if (content.length > 300) content = content.substring(0, 300) + '...';
      output += `\n${content}\n`;
    }
    output += '\n---\n\n';
  }

  return output;
}

// ─── Helper: Run CLI Command ───

function runCommand(command, args, timeout = 30000) {
  return new Promise((resolve) => {
    try {
      const proc = spawn(command, args, {
        timeout,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code !== 0 && !stdout) {
          resolve({ stdout: '', error: stderr || `Process exited with code ${code}` });
        } else {
          resolve({ stdout, error: null });
        }
      });

      proc.on('error', (err) => {
        resolve({ stdout: '', error: err.message });
      });
    } catch (err) {
      resolve({ stdout: '', error: err.message });
    }
  });
}

// ─── Helpers ───

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return 'N/A';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatNumber(num) {
  if (!num || isNaN(num)) return 'N/A';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

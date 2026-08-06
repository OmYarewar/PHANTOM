import fs from 'fs';
import path from 'path';
import { recallMemory } from '../memory/store.js';

/**
 * Runs at the start of every new Telegram session.
 * Reads skills folder and memory store, returns a context string
 * to be prepended to the system prompt.
 *
 * @returns {Promise<{ skillsSummary: string, memorySummary: string, raw: object }>}
 */
export async function bootstrapSession() {
  const [skills, memories] = await Promise.all([
    loadSkills(),
    loadMemories(),
  ]);

  const skillsSummary = formatSkillsSummary(skills);
  const memorySummary = formatMemorySummary(memories);

  return {
    skillsSummary,
    memorySummary,
    raw: { skills, memories },
  };
}

/**
 * Reads the skills folder and returns an array of skill metadata.
 * Skills can be .json files (with name/description fields),
 * .md files (use filename as name, first line as description),
 * or .zip files (use filename as name).
 */
async function loadSkills() {
  const dirsToScan = [
    '/home/oki/.gemini/config/skills',
    path.resolve(process.cwd(), 'skills'),
  ];

  const seen = new Set();
  const allSkills = [];

  for (const dir of dirsToScan) {
    try {
      await fs.promises.access(dir);
      const entries = await fs.promises.readdir(dir);

      for (const entry of entries) {
        if (seen.has(entry)) continue;
        const fullPath = path.join(dir, entry);

        try {
          const stat = await fs.promises.stat(fullPath);
          if (stat.isDirectory()) {
            seen.add(entry);
            let name = entry;
            let description = 'Skill folder';

            // Try skill.json
            try {
              const content = await fs.promises.readFile(path.join(fullPath, 'skill.json'), 'utf8');
              const meta = JSON.parse(content);
              name = meta.name || name;
              description = meta.description || description;
            } catch {}

            // Try SKILL.md
            try {
              const content = await fs.promises.readFile(path.join(fullPath, 'SKILL.md'), 'utf8');
              const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
              if (match) {
                const descMatch = match[1].match(/description:\s*(.+)/);
                if (descMatch) description = descMatch[1].trim();
              }
            } catch {}

            allSkills.push({ name, description, type: 'folder' });
          }
        } catch {}
      }
    } catch {}
  }

  return allSkills;
}

/**
 * Loads the most recent memories from the SQLite store.
 * Gets up to 30 most recent entries — enough context without bloating the prompt.
 */
async function loadMemories() {
  try {
    // Use the existing recallMemory function with a broad query
    // to get recent memories
    const memories = await recallMemory('', { limit: 30, orderBy: 'recent' });
    return memories || [];
  } catch (err) {
    console.error('[Bootstrap] Could not load memories:', err.message);
    return [];
  }
}

/**
 * Formats skills into a concise system prompt section.
 */
function formatSkillsSummary(skills) {
  if (!skills || skills.length === 0) {
    return 'No skills installed.';
  }

  const lines = skills.map(s => `- **${s.name}**: ${s.description}`);
  return lines.join('\n');
}

/**
 * Formats memories into a concise system prompt section.
 */
function formatMemorySummary(memories) {
  if (!memories || memories.length === 0) {
    return 'No memories saved yet.';
  }

  // Show the most recent 20, truncate old ones
  const recent = memories.slice(0, 20);
  const lines = recent.map((m, i) => {
    const content = String(m.value || m.content || m).slice(0, 150);
    const key = m.key ? `[${m.key}] ` : '';
    return `${i + 1}. ${key}${content}`;
  });

  if (memories.length > 20) {
    lines.push(`... and ${memories.length - 20} more memories`);
  }

  return lines.join('\n');
}

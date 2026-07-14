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
  const skillsDir = path.resolve(process.cwd(), 'skills');

  try {
    await fs.promises.access(skillsDir);
  } catch {
    return [];
  }

  const entries = await fs.promises.readdir(skillsDir);
  const skillsPromises = entries.map(async (entry) => {
    const fullPath = path.join(skillsDir, entry);

    try {
      const stat = await fs.promises.stat(fullPath);

      if (stat.isDirectory()) {
        const metaPath = path.join(fullPath, 'skill.json');
        const readmePath = path.join(fullPath, 'README.md');

        try {
          const content = await fs.promises.readFile(metaPath, 'utf8');
          const meta = JSON.parse(content);
          return {
            name: meta.name || entry,
            description: meta.description || 'No description',
            version: meta.version || '1.0.0',
            type: 'folder',
          };
        } catch (err) {
          if (err.code !== 'ENOENT') throw err;
        }

        try {
          const content = await fs.promises.readFile(readmePath, 'utf8');
          const lines = content.split('\n');
          const name = lines[0].replace(/^#+\s*/, '').trim() || entry;
          const description = lines.find(l => l.trim() && !l.startsWith('#')) || 'No description';
          return { name, description: description.trim(), type: 'folder' };
        } catch (err) {
          if (err.code !== 'ENOENT') throw err;
        }

        return { name: entry, description: 'Skill folder', type: 'folder' };
      } else if (entry.endsWith('.json')) {
        const content = await fs.promises.readFile(fullPath, 'utf8');
        const meta = JSON.parse(content);
        return {
          name: meta.name || entry.replace('.json', ''),
          description: meta.description || 'No description',
          version: meta.version || '1.0.0',
          type: 'json',
        };
      } else if (entry.endsWith('.zip')) {
        return {
          name: entry.replace('.zip', ''),
          description: 'Packaged skill',
          type: 'zip',
        };
      }
    } catch (err) {
      return { name: entry, description: `Could not read: ${err.message}`, type: 'unknown' };
    }

    return null;
  });

  const skills = await Promise.all(skillsPromises);
  return skills.filter(Boolean);
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

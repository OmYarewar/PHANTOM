import fs from 'fs';
import path from 'path';

/**
 * Returns a list of all currently available skills and their descriptions,
 * allowing the AI to be more self-aware.
 */
function parseSkillMeta(skillPath, folderName) {
  let meta = { name: folderName, description: 'No description available.', files: [] };

  // 1. Try reading skill.json
  const jsonPath = path.join(skillPath, 'skill.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      meta.name = parsed.name || meta.name;
      meta.description = parsed.description || meta.description;
    } catch {}
  }

  // 2. Try reading SKILL.md frontmatter if present
  const mdPath = path.join(skillPath, 'SKILL.md');
  if (fs.existsSync(mdPath)) {
    try {
      const content = fs.readFileSync(mdPath, 'utf8');
      const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (match) {
        const frontmatter = match[1];
        const nameMatch = frontmatter.match(/name:\s*(.+)/);
        const descMatch = frontmatter.match(/description:\s*(.+)/);
        if (nameMatch) meta.name = nameMatch[1].trim();
        if (descMatch) meta.description = descMatch[1].trim();
      }
    } catch {}
  }

  try {
    const files = fs.readdirSync(skillPath);
    meta.files = files.slice(0, 15);
  } catch {}

  return meta;
}

export function getSystemCapabilities(primarySkillsDir) {
  try {
    const dirsToScan = [
      primarySkillsDir,
      '/home/oki/.gemini/config/skills',
      path.join(process.cwd(), 'skills'),
    ].filter(Boolean);

    const seen = new Set();
    const skills = [];

    for (const dir of dirsToScan) {
      if (!fs.existsSync(dir)) continue;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && !seen.has(e.name)) {
          seen.add(e.name);
          const skillPath = path.join(dir, e.name);
          skills.push(parseSkillMeta(skillPath, e.name));
        }
      }
    }

    return JSON.stringify({
      message: `Found ${skills.length} available skills (including Reverse-Skill pack).`,
      skills
    });
  } catch (error) {
    return JSON.stringify({ error: `Failed to retrieve capabilities: ${error.message}` });
  }
}

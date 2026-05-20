import fs from 'fs';
import path from 'path';

/**
 * Returns a list of all currently available skills and their descriptions,
 * allowing the AI to be more self-aware.
 */
export function getSystemCapabilities(skillsDir) {
  try {
    if (!fs.existsSync(skillsDir)) {
      return JSON.stringify({ message: 'Skills directory does not exist.', skills: [] });
    }

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    const skills = entries.filter(e => e.isDirectory()).map(e => {
      const skillPath = path.join(skillsDir, e.name);
      let meta = { name: e.name, description: 'No description available.', files: [] };

      try {
        const metaPath = path.join(skillPath, 'skill.json');
        if (fs.existsSync(metaPath)) {
          const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          meta.description = parsed.description || meta.description;
        }
      } catch (err) {
        // Ignore read/parse errors for skill.json
      }
      return meta;
    });

    return JSON.stringify({
      message: `Found ${skills.length} available skills.`,
      skills
    });
  } catch (error) {
    return JSON.stringify({ error: `Failed to retrieve capabilities: ${error.message}` });
  }
}

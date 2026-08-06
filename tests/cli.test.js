import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.join(__dirname, '..', 'bin', 'phantom.js');

describe('PHANTOM CLI executable', () => {
  it('displays help menu with --help flag', () => {
    const output = execSync(`node "${cliPath}" --help`).toString();
    expect(output).toContain('PHANTOM CLI');
    expect(output).toContain('Usage:');
    expect(output).toContain('phantom [command] [options]');
  });

  it('displays version with --version flag', () => {
    const output = execSync(`node "${cliPath}" --version`).toString();
    expect(output).toContain('phantom v');
  });

  it('displays help with -h flag', () => {
    const output = execSync(`node "${cliPath}" -h`).toString();
    expect(output).toContain('PHANTOM CLI');
  });

  it('displays version with -v flag', () => {
    const output = execSync(`node "${cliPath}" -v`).toString();
    expect(output).toContain('phantom v');
  });
});

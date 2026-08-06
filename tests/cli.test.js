import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.join(__dirname, '..', 'bin', 'phantom.js');

const stripAnsi = (str) => str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\u001b\[[0-9;]*[mG]/g, '');

describe('PHANTOM CLI executable', () => {
  it('displays help menu with --help flag', () => {
    const raw = execSync(`node "${cliPath}" --help`).toString();
    const output = stripAnsi(raw);
    expect(output).toContain('PHANTOM CLI');
    expect(output).toContain('Usage:');
    expect(output).toContain('phantom [command] [options]');
  });

  it('displays version with --version flag', () => {
    const raw = execSync(`node "${cliPath}" --version`).toString();
    const output = stripAnsi(raw);
    expect(output).toContain('phantom v');
  });

  it('displays help with -h flag', () => {
    const raw = execSync(`node "${cliPath}" -h`).toString();
    const output = stripAnsi(raw);
    expect(output).toContain('PHANTOM CLI');
  });

  it('displays version with -v flag', () => {
    const raw = execSync(`node "${cliPath}" -v`).toString();
    const output = stripAnsi(raw);
    expect(output).toContain('phantom v');
  });
});

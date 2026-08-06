#!/usr/bin/env node

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { spawn, execSync } from 'child_process';
import { printHelpBanner } from '../server/banner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Check and auto-repair native module NODE_MODULE_VERSION mismatch
async function verifyNativeModules() {
  try {
    const Database = (await import('better-sqlite3')).default;
    const testDb = new Database(':memory:');
    testDb.close();
  } catch (err) {
    if (err.code === 'ERR_DLOPEN_FAILED' || err.message?.includes('NODE_MODULE_VERSION')) {
      console.log(`\n\x1b[38;2;234;179;8m⚠️ Native addon mismatch detected for Node.js ${process.version}.\x1b[0m`);
      console.log(`\x1b[38;2;6;182;212m🔧 Auto-rebuilding native sqlite3 module...\x1b[0m\n`);
      try {
        execSync('npm rebuild better-sqlite3', { cwd: projectRoot, stdio: 'inherit' });
        console.log(`\x1b[38;2;16;185;129m✓ Auto-rebuild complete!\x1b[0m\n`);
      } catch (rebuildErr) {
        console.error('⚠️ Auto-rebuild failed:', rebuildErr.message);
      }
    }
  }
}

const args = process.argv.slice(2);

function printVersion() {
  try {
    const pkgPath = join(projectRoot, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    console.log(`\x1b[38;2;16;185;129m\x1b[1mphantom\x1b[0m \x1b[37mv${pkg.version}\x1b[0m`);
  } catch {
    console.log('phantom v1.0.0');
  }
}

let command = 'start';
let port = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h' || arg === 'help') {
    printHelpBanner();
    process.exit(0);
  } else if (arg === '--version' || arg === '-v' || arg === 'version') {
    printVersion();
    process.exit(0);
  } else if (arg === '-p' || arg === '--port') {
    port = args[++i];
  } else if (arg === 'start' || arg === 'dev') {
    command = arg;
  }
}

if (port) {
  process.env.PORT = port;
}

async function main() {
  await verifyNativeModules();

  if (command === 'dev') {
    process.env.PHANTOM_DEV = 'true';
    const serverPath = join(projectRoot, 'server', 'index.js');
    const viteBin = join(projectRoot, 'node_modules', '.bin', 'vite');

    const nodeProc = spawn(process.execPath, [serverPath], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env
    });

    const viteProc = spawn(viteBin, ['--port', '5173'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env
    });

    const cleanup = () => {
      nodeProc.kill();
      viteProc.kill();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  } else {
    const serverPath = join(projectRoot, 'server', 'index.js');
    const child = spawn(process.execPath, [serverPath], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  }
}

main().catch(err => {
  console.error('[PHANTOM CLI Error]', err);
  process.exit(1);
});

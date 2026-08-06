#!/usr/bin/env node

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { spawn, execSync } from 'child_process';
import { printHelpBanner } from '../server/banner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Check and auto-repair native module NODE_MODULE_VERSION/sharp mismatch
async function verifyNativeModules() {
  let needsRebuild = false;

  try {
    const Database = (await import('better-sqlite3')).default;
    const testDb = new Database(':memory:');
    testDb.close();
  } catch (err) {
    if (err.code === 'ERR_DLOPEN_FAILED' || err.message?.includes('NODE_MODULE_VERSION')) {
      needsRebuild = true;
    }
  }

  try {
    await import('@xenova/transformers');
  } catch (err) {
    if (err.code === 'ERR_DLOPEN_FAILED' || err.message?.includes('sharp') || err.message?.includes('NODE_MODULE_VERSION')) {
      needsRebuild = true;
    }
  }

  if (needsRebuild) {
    console.log(`\n\x1b[38;2;234;179;8m⚠️ Native addon issue/mismatch detected for Node.js ${process.version}.\x1b[0m`);
    console.log(`\x1b[38;2;6;182;212m🔧 Auto-repairing native binaries (better-sqlite3, sharp)...\x1b[0m\n`);
    try {
      execSync('npm install --os=linux --cpu=x64 sharp @img/sharp-linux-x64 @img/sharp-libvips-linux-x64 --quiet && npm rebuild better-sqlite3 sharp --quiet', { cwd: projectRoot, stdio: 'inherit' });
      console.log(`\x1b[38;2;16;185;129m✓ Auto-repair complete!\x1b[0m\n`);
    } catch (rebuildErr) {
      console.error('⚠️ Auto-repair failed:', rebuildErr.message);
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
  const serverPath = join(projectRoot, 'server', 'index.js');
  const viteBin = join(projectRoot, 'node_modules', '.bin', 'vite');

  if (command === 'dev') {
    process.env.PHANTOM_DEV = 'true';

    const viteProc = spawn(viteBin, ['--port', '5173'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env
    });

    const cleanup = () => {
      viteProc.kill();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    let keepRunning = true;
    while (keepRunning) {
      await verifyNativeModules();
      await new Promise((resolve) => {
        const nodeProc = spawn(process.execPath, [serverPath], {
          cwd: projectRoot,
          stdio: 'inherit',
          env: process.env
        });

        nodeProc.on('exit', (code) => {
          if (code === 42) {
            console.log('\n\x1b[38;2;6;182;212m🔄 System update complete! Auto-restarting PHANTOM server...\x1b[0m\n');
            resolve();
          } else {
            keepRunning = false;
            viteProc.kill();
            process.exit(code ?? 0);
          }
        });
      });
    }
  } else {
    const cleanup = () => {
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    let keepRunning = true;
    while (keepRunning) {
      await verifyNativeModules();
      await new Promise((resolve) => {
        const child = spawn(process.execPath, [serverPath], {
          cwd: projectRoot,
          stdio: 'inherit',
          env: process.env
        });

        child.on('exit', (code) => {
          if (code === 42) {
            console.log('\n\x1b[38;2;6;182;212m🔄 System update complete! Auto-restarting PHANTOM server...\x1b[0m\n');
            resolve();
          } else {
            keepRunning = false;
            process.exit(code ?? 0);
          }
        });
      });
    }
  }
}

main().catch(err => {
  console.error('[PHANTOM CLI Error]', err);
  process.exit(1);
});

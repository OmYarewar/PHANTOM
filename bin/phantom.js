#!/usr/bin/env node

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
👻 PHANTOM CLI — AI-Powered Pentesting Command Center

Usage:
  phantom [command] [options]

Commands:
  start               Start the production PHANTOM server (default)
  dev                 Start development server (backend + frontend dev server)
  help, -h, --help    Show this help message
  version, -v, --version Show PHANTOM version

Options:
  -p, --port <port>   Set the port for the server (default: 1337 or PORT env)

Examples:
  $ phantom start
  $ phantom start --port 8080
  $ phantom dev
  $ phantom --version
`);
}

function printVersion() {
  try {
    const pkgPath = join(projectRoot, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    console.log(`phantom v${pkg.version}`);
  } catch (err) {
    console.log('phantom v1.0.0');
  }
}

let command = 'start';
let port = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h' || arg === 'help') {
    printHelp();
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

if (command === 'dev') {
  console.log('🚀 Starting PHANTOM in development mode...');
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
  console.log('🚀 Starting PHANTOM server...');
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

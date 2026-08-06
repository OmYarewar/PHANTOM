const G = '\x1b[38;2;16;185;129m';   // Emerald Green #10b981
const CG = '\x1b[38;2;52;211;153m';  // Light Emerald #34d399
const C = '\x1b[38;2;6;182;212m';    // Cyan #06b6d4
const B = '\x1b[1m';                 // Bold
const DIM = '\x1b[2m';               // Dim
const RST = '\x1b[0m';               // Reset
const W = '\x1b[37m';                // White
const Y = '\x1b[38;2;234;179;8m';    // Yellow

export function printBanner(options = {}) {
  const port = options.port || 1337;
  const mode = options.mode || 'Production';
  const vitePort = options.vitePort || 5173;
  const provider = options.provider || 'OpenAI';
  const model = options.model || 'gpt-4o';

  const asciiLogo = `
${G}${B}  ██████╗ ██╗  ██╗██████╗ ███╗   ██╗████████╗██████╗ ███╗   ███╗
  ██╔══██╗██║  ██║██╔══██╗████╗  ██║╚══██╔══╝██╔══██╗████╗ ████║
  ██████╔╝███████║██████╔╝██╔██╗ ██║   ██║   ██║  ██║██╔████╔██║
  ██╔═══╝ ██╔══██║██╔══██╗██║╚██╗██║   ██║   ██║  ██║██║╚██╔╝██║
  ██║     ██║  ██║██║  ██║██║ ╚████║   ██║   ██████╔╝██║ ╚═╝ ██║
  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═════╝ ╚═╝     ╚═╝${RST}
`;

  console.log(asciiLogo);
  console.log(`  ${G}${B}👻 PHANTOM — AI-Powered Pentesting Command Center${RST} ${DIM}(v1.0.0)${RST}`);
  console.log(`  ${DIM}────────────────────────────────────────────────────────────${RST}`);
  console.log(`  ${G}●${RST} ${B}Server Status${RST} : ${CG}${B}ONLINE${RST} ${DIM}(${mode} Mode)${RST}`);
  console.log(`  ${C}🌐 Backend API${RST}   : ${W}${B}http://localhost:${port}${RST}`);
  console.log(`  ${C}⚡ WebSocket${RST}     : ${W}${B}ws://localhost:${port}/ws${RST}`);
  if (options.isDev) {
    console.log(`  ${Y}🎨 Web UI (Dev)${RST}  : ${W}${B}http://localhost:${vitePort}${RST}`);
  } else {
    console.log(`  ${G}🎨 Web UI${RST}        : ${W}${B}http://localhost:${port}${RST}`);
  }
  console.log(`  ${C}🧠 AI Engine${RST}     : ${W}${provider}${RST} ${DIM}(${model})${RST}`);
  console.log(`  ${DIM}────────────────────────────────────────────────────────────${RST}\n`);
}

export function printHelpBanner() {
  const asciiLogo = `
${G}${B}  ██████╗ ██╗  ██╗██████╗ ███╗   ██╗████████╗██████╗ ███╗   ███╗
  ██╔══██╗██║  ██║██╔══██╗████╗  ██║╚══██╔══╝██╔══██╗████╗ ████║
  ██████╔╝███████║██████╔╝██╔██╗ ██║   ██║   ██║  ██║██╔████╔██║
  ██╔═══╝ ██╔══██║██╔══██╗██║╚██╗██║   ██║   ██║  ██║██║╚██╔╝██║
  ██║     ██║  ██║██║  ██║██║ ╚████║   ██║   ██████╔╝██║ ╚═╝ ██║
  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═════╝ ╚═╝     ╚═╝${RST}
`;

  console.log(asciiLogo);
  console.log(`  ${G}${B}👻 PHANTOM CLI — AI-Powered Pentesting Command Center${RST}`);
  console.log(`  ${DIM}────────────────────────────────────────────────────────────${RST}`);
  console.log(`  ${B}Usage:${RST}`);
  console.log(`    ${G}phantom${RST} ${C}[command]${RST} ${DIM}[options]${RST}\n`);
  console.log(`  ${B}Commands:${RST}`);
  console.log(`    ${C}start${RST}               Start production PHANTOM server ${DIM}(default)${RST}`);
  console.log(`    ${C}dev${RST}                 Start dev server (backend + Vite UI)`);
  console.log(`    ${C}help, -h, --help${RST}    Show this help menu`);
  console.log(`    ${C}version, -v${RST}         Show version\n`);
  console.log(`  ${B}Options:${RST}`);
  console.log(`    ${Y}-p, --port <port>${RST}   Specify custom port ${DIM}(default: 1337)${RST}\n`);
  console.log(`  ${B}Examples:${RST}`);
  console.log(`    ${DIM}$${RST} ${G}phantom start${RST}`);
  console.log(`    ${DIM}$${RST} ${G}phantom dev${RST}`);
  console.log(`    ${DIM}$${RST} ${G}phantom start --port 8080${RST}`);
  console.log(`  ${DIM}────────────────────────────────────────────────────────────${RST}\n`);
}

<div align="center">

# 👻 PHANTOM

### AI-Powered Pentesting Command Center

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://www.linux.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge)](https://github.com/pulls)

**An autonomous AI assistant for penetration testing, security research, and general-purpose tasks.**  
Real-time tool execution • Unlimited autonomous operations • Self-improving AI • Beautiful dark UI

<img src="https://img.shields.io/badge/Status-Active-22c55e?style=flat-square" />
<img src="https://img.shields.io/badge/Security-Offensive-ef4444?style=flat-square" />
<img src="https://img.shields.io/badge/AI-Autonomous-6366f1?style=flat-square" />

---

</div>

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **Any LLM Backend** | OpenAI, OpenRouter, Ollama, LM Studio, DeepSeek, Claude — any OpenAI-compatible API |
| ⚡ **Real-Time Streaming** | Live tool execution output, typing animations, and AI thinking display |
| 🔓 **Unlimited Operations** | No tool call limits — PHANTOM runs autonomously until the task is done |
| 🧠 **Self-Improving** | Creates its own tools, saves execution traces, learns from past runs |
| 🔑 **Secure Sudo** | One-time sudo password with system validation — persisted securely |
| 📁 **Workspace System** | Configurable workspace directory for scripts, reports, and file operations |
| 🧩 **MCP Integration** | Model Context Protocol server management for extended capabilities |
| 📦 **Skills System** | Import, manage, and create reusable skill packages (.zip import supported) |
| 🌐 **Web Research** | Built-in web search and webpage scraping for real-time information |
| 💾 **Persistent Memory** | Remembers targets, credentials, findings across sessions |
| 🛑 **Emergency Stop** | Instant abort button to halt any running operation |
| 🎨 **Premium Dark UI** | Glassmorphism, matrix background, smooth animations |

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([install](https://nodejs.org))
- **npm** (comes with Node.js)
- Any **OpenAI-compatible API** key

### Installation

```bash
# Clone the repository
git clone https://github.com/OmYarewar/PHANTOM.git
cd PHANTOM

# Install dependencies
npm install

# Configure your API
cp .env.example .env
nano .env  # Add your API key and model
```

### Configuration

Edit `.env` with your API provider:

```env
# OpenAI
API_BASE_URL=https://api.openai.com/v1
API_KEY=sk-your-key-here
MODEL_ID=gpt-4o

# OpenRouter (access to 100+ models)
API_BASE_URL=https://openrouter.ai/api/v1
API_KEY=sk-or-your-key-here
MODEL_ID=deepseek/deepseek-chat

# Ollama (local, free)
API_BASE_URL=http://localhost:11434/v1
API_KEY=ollama
MODEL_ID=llama3

# LM Studio (local)
API_BASE_URL=http://localhost:1234/v1
API_KEY=lm-studio
MODEL_ID=your-model-name
```

### Run

```bash
npm run dev
```

Open **http://localhost:5173** in your browser. That's it! 🎉

## 🏗️ Architecture

```
PHANTOM/
├── server/                 # Backend (Express + WebSocket)
│   ├── ai/
│   │   ├── llm-client.js   # LLM communication & streaming
│   │   └── system-prompt.js # Dynamic system prompt builder
│   ├── tools/
│   │   ├── executor.js      # Tool execution engine (14 tools)
│   │   └── registry.js      # Tool definitions for function calling
│   ├── memory/
│   │   └── store.js         # SQLite persistence layer
│   ├── routes/
│   │   └── api.js           # REST API endpoints
│   ├── config.js            # Configuration management
│   └── index.js             # Server entry point
├── frontend/               # Frontend (Vanilla JS + Vite)
│   ├── css/styles.css       # Dark theme design system
│   ├── js/
│   │   ├── app.js           # Main controller & WebSocket
│   │   ├── chat.js          # Chat rendering & animations
│   │   ├── settings.js      # Settings panel
│   │   ├── management.js    # MCP & Skills management
│   │   └── markdown.js      # Markdown renderer
│   └── index.html           # Main page
├── workspace/              # AI workspace (scripts, reports, skills)
├── .env.example            # Configuration template
├── vite.config.js          # Vite dev server config
└── package.json
```

## 🛠️ Available Tools

PHANTOM has **14 built-in tools** that the AI uses autonomously:

| Tool | Purpose |
|------|---------|
| `execute_command` | Run shell commands with auto sudo injection |
| `read_file` | Read file contents |
| `write_file` | Write/create files |
| `list_directory` | List directory contents |
| `install_tool` | Auto-install packages (apt/pacman/pip/npm/go/cargo) |
| `web_request` | HTTP requests for recon & API testing |
| `search_web` | Web search via DuckDuckGo |
| `scrape_webpage` | Fetch & parse webpage content |
| `python_execute` | Execute Python code directly |
| `save_memory` | Store findings to persistent memory |
| `recall_memory` | Search persistent memory |
| `edit_source_code` | Self-modify PHANTOM's own code |
| `save_trace` | Log execution traces for self-optimization |

## 🔒 Security Notes

- **Sudo passwords** are stored in a local SQLite database on your machine only
- **API keys** are stored locally and never transmitted except to your configured API endpoint
- The `.env` file and `phantom.db` are excluded from git
- PHANTOM runs **locally only** — no external telemetry or data collection
- The `edit_source_code` tool only works within the project directory and creates backups

## 🎨 Screenshots

<details>
<summary>Click to expand</summary>

### Main Interface
The dark-themed command center with matrix background, real-time streaming, and AI thinking display.

### Settings Panel
Configure API provider, model, temperature, workspace, and sudo access.

### Management Panel
Manage MCP servers and skills with tabbed interface and .zip import.

</details>

## ⚙️ Settings (via Web UI)

All settings can be configured from the web UI and **persist across restarts**:

- **API Configuration** — Base URL, API key, model, temperature, max tokens
- **Workspace** — Default directory for all AI file operations
- **Sudo Password** — System-validated and securely stored
- **MCP Servers** — Add/remove Model Context Protocol servers
- **Skills** — Import .zip skill packages or let AI create them

## 🧠 How It Works

1. **You ask** — Type a request in the chat
2. **AI thinks** — Reasoning displayed in real-time (for supported models)
3. **AI acts** — Executes tools autonomously with live output streaming
4. **AI reports** — Clean, formatted results with typing animation
5. **AI learns** — Saves traces and memories for future optimization

PHANTOM implements ideas from [Meta-Harness](https://arxiv.org/abs/2603.28052) for automated harness optimization — the AI can review its own execution traces and improve its approach over time.

## 📋 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/settings` | GET/PUT | Configuration management |
| `/api/conversations` | GET/POST | Conversation CRUD |
| `/api/conversations/:id` | GET/DELETE | Single conversation |
| `/api/tools` | GET | List available tools |
| `/api/memory` | GET | Query persistent memory |
| `/api/mcp/servers` | GET/POST/DELETE | MCP server management |
| `/api/skills` | GET | List installed skills |
| `/api/skills/upload` | POST | Import skill (.zip) |
| `/api/sudo/validate` | POST | Validate sudo password |
| `/api/system/info` | GET | System information |
| `/ws` | WebSocket | Real-time chat & streaming |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/awesome`)
3. Commit your changes (`git commit -m 'Add awesome feature'`)
4. Push to the branch (`git push origin feature/awesome`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

PHANTOM is designed for **authorized security testing only**. Always obtain proper authorization before testing any systems. The developers are not responsible for misuse of this tool.

---

<div align="center">

**Built with 🖤 for the security community**

</div>

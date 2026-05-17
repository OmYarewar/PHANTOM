/**
 * Tool definitions in OpenAI function calling format
 */
export function getToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'execute_command',
        description: 'Execute a shell command on the local system. Use for running security tools, scripts, system commands, etc. Supports bash syntax including pipes, redirects, and background processes.',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute. Can include pipes (|), redirects (>), background (&), etc.',
            },
            timeout: {
              type: 'integer',
              description: 'Timeout in seconds (default: 120). Set higher for long-running scans.',
              default: 120,
            },
            working_directory: {
              type: 'string',
              description: 'Working directory for the command. Defaults to home directory.',
            },
            use_sudo: {
              type: 'boolean',
              description: 'Whether to prepend sudo to the command. The configured sudo password will be used.',
              default: false,
            },
          },
          required: ['command'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the contents of a file from the filesystem. Use for analyzing configs, logs, source code, scan results, etc.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to the file to read.',
            },
            max_lines: {
              type: 'integer',
              description: 'Maximum number of lines to read (default: 500). Use to limit output for large files.',
              default: 500,
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write content to a file. Creates parent directories if needed. Use for scripts, configs, payloads, reports.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path where the file should be written.',
            },
            content: {
              type: 'string',
              description: 'The content to write to the file.',
            },
            append: {
              type: 'boolean',
              description: 'If true, append to existing file instead of overwriting.',
              default: false,
            },
          },
          required: ['path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'install_tool',
        description: 'Install a security tool or package. Automatically detects the best installation method (apt/pacman/yum, pip, go install, git clone, etc.).',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the tool to install (e.g., "nmap", "sqlmap", "gobuster").',
            },
            method: {
              type: 'string',
              enum: ['auto', 'apt', 'pacman', 'yum', 'pip', 'pipx', 'go', 'cargo', 'npm', 'git', 'snap'],
              description: 'Installation method. Use "auto" for automatic detection.',
              default: 'auto',
            },
            source: {
              type: 'string',
              description: 'Source URL for git clone or specific package name. Required for "git" method.',
            },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'web_request',
        description: 'Make an HTTP/HTTPS request. Use for web reconnaissance, API testing, downloading files, etc.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to request.',
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
              description: 'HTTP method.',
              default: 'GET',
            },
            headers: {
              type: 'object',
              description: 'Request headers as key-value pairs.',
            },
            body: {
              type: 'string',
              description: 'Request body (for POST/PUT/PATCH).',
            },
            follow_redirects: {
              type: 'boolean',
              description: 'Whether to follow redirects.',
              default: true,
            },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_web',
        description: 'Search the web for information. Use to find exploits, CVEs, tool documentation, attack techniques, etc.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query.',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scrape_webpage',
        description: 'Scrape a webpage and extract readable text content. Strips HTML tags, scripts, styles. Use for reading documentation, CVE details, exploit-db pages, blog posts, etc.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL of the webpage to scrape.',
            },
            max_length: {
              type: 'integer',
              description: 'Maximum length of extracted text (default: 30000 chars).',
              default: 30000,
            },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'save_memory',
        description: 'Save important information to persistent memory. Use for targets, credentials, findings, network maps, etc.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['target', 'credential', 'finding', 'vulnerability', 'network', 'note', 'tool_config'],
              description: 'Category of the memory.',
            },
            key: {
              type: 'string',
              description: 'A short descriptive key (e.g., "target_ip", "admin_password", "open_ports_192.168.1.1").',
            },
            value: {
              type: 'string',
              description: 'The information to remember.',
            },
          },
          required: ['category', 'key', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'recall_memory',
        description: 'Search persistent memory for previously stored information.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find relevant memories.',
            },
            category: {
              type: 'string',
              enum: ['target', 'credential', 'finding', 'vulnerability', 'network', 'note', 'tool_config'],
              description: 'Optional category filter.',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_directory',
        description: 'List the contents of a directory with file details.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory to list.',
            },
            show_hidden: {
              type: 'boolean',
              description: 'Whether to show hidden files (dotfiles).',
              default: false,
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'python_execute',
        description: 'Execute a Python script inline. Use for data processing, exploit development, custom tools, etc.',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Python code to execute.',
            },
            timeout: {
              type: 'integer',
              description: 'Timeout in seconds.',
              default: 60,
            },
          },
          required: ['code'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'edit_source_code',
        description: 'Edit PHANTOM source code files for self-improvement. Creates backups automatically. Only works within the project directory.',
        parameters: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute path to the source file to edit.',
            },
            content: {
              type: 'string',
              description: 'The new file content.',
            },
            description: {
              type: 'string',
              description: 'Description of what was changed and why.',
            },
          },
          required: ['file_path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'save_trace',
        description: 'Save an execution trace for self-optimization. Record what worked, what failed, and lessons learned after complex tasks.',
        parameters: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'Brief description of the task attempted.',
            },
            approach: {
              type: 'string',
              description: 'The approach/methodology used.',
            },
            outcome: {
              type: 'string',
              description: 'Result: success, partial, or failure.',
            },
            score: {
              type: 'number',
              description: 'Optional score 0-10 rating the approach effectiveness.',
            },
            notes: {
              type: 'string',
              description: 'Lessons learned and what to try differently next time.',
            },
          },
          required: ['task', 'approach', 'outcome'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scrapling_fetch',
        description: 'Advanced web scraping powered by Scrapling. Supports 3 modes: "basic" (fast HTTP with TLS fingerprint spoofing), "stealth" (headless browser that bypasses Cloudflare/anti-bot), "dynamic" (full Playwright browser for JS-heavy sites). Can extract data with CSS/XPath selectors or return full page text, title, and links.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to scrape.',
            },
            mode: {
              type: 'string',
              enum: ['basic', 'stealth', 'dynamic'],
              description: 'Fetcher mode. "basic" = fast HTTP. "stealth" = anti-bot bypass (Cloudflare). "dynamic" = full browser rendering.',
              default: 'basic',
            },
            css_selector: {
              type: 'string',
              description: 'CSS selector to extract specific elements (e.g. ".product h2", "table tr").',
            },
            xpath: {
              type: 'string',
              description: 'XPath selector to extract specific elements.',
            },
            proxy: {
              type: 'string',
              description: 'Proxy URL (e.g. "http://user:pass@proxy:8080").',
            },
            solve_cloudflare: {
              type: 'boolean',
              description: 'Whether to solve Cloudflare challenges in stealth mode. Default true.',
              default: true,
            },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'show_preview_window',
        description: 'Render interactive HTML, JS, CSS, charts, or graphs directly in the user\'s UI. Use this when the user asks for a visual representation, code demo, or graphical target map.',
        parameters: {
          type: 'object',
          properties: {
            html_content: {
              type: 'string',
              description: 'The HTML code to render. Can include inline <style> and <script> tags for interactivity.',
            },
            title: {
              type: 'string',
              description: 'The title to display on the preview window.',
            },
          },
          required: ['html_content', 'title'],
        },
      },
    },
  ];
}

/**
 * Tool definitions in OpenAI function calling format
 */
export function getToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'send_telegram_media',
        description: 'Send a media file (image, document, etc.) from the local system to the user via Telegram.',
        parameters: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute path to the file to send.',
            },
            caption: {
              type: 'string',
              description: 'Optional caption to include with the media.',
            },
          },
          required: ['file_path'],
        },
      },
    },
  {
    type: 'function',
    function: {
      name: 'show_code_demo',
      description: 'Render syntax-highlighted code directly in the user\'s UI. Use this when the user asks for a code demonstration or snippet to be displayed in a clean, highlighted window.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The code to render and highlight.',
          },
          language: {
            type: 'string',
            description: 'The programming language of the code (e.g., "javascript", "python", "html").',
          },
          title: {
            type: 'string',
            description: 'The title to display on the preview window.',
          },
        },
        required: ['code', 'language'],
      },
    },
  },
    {
      type: 'function',
      function: {
        name: 'get_system_capabilities',
        description: 'Get a list of all currently available skills and their descriptions, allowing the AI to be self-aware of its capabilities.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_conversations',
        description: 'Search past conversations for context and recall. Provides blazing-fast FTS5 full-text search across all messages.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to look up in past conversations.',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delegate_task',
        description: 'Spawn an isolated subagent to complete a sub-task or research independently, returning the final result (hierarchical subagent-driven development).',
        parameters: {
          type: 'object',
          properties: {
            task_description: {
              type: 'string',
              description: 'A detailed description of the task for the subagent to perform.',
            },
          },
          required: ['task_description'],
        },
      },
    },

    {
      type: 'function',
      function: {
        name: 'write_skill',
        description: 'Create and register a new AI skill dynamically. This allows you to add new custom tools or scripts to the workspace skills directory.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The name of the new skill (should be a short, directory-friendly name).',
            },
            description: {
              type: 'string',
              description: 'A description of what the skill does.',
            },
            code: {
              type: 'string',
              description: 'The Python or Bash code for the skill.',
            },
            entry_point: {
              type: 'string',
              description: 'The filename for the main entry point (e.g., "script.py", "run.sh").',
              default: 'script.py',
            },
          },
          required: ['name', 'description', 'code'],
        },
      },
    },
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
        description: 'Save important information to the AgentMemory Engine. Supports 4-tier taxonomy (episodic, semantic, procedural, working) and importance scoring.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['episodic', 'semantic', 'procedural', 'working', 'target', 'credential', 'finding', 'vulnerability', 'network', 'note', 'tool_config'],
              description: 'Category/tier of the memory (episodic=session logs/debug, semantic=facts/schemas, procedural=workflows/scripts, working=current context).',
            },
            key: {
              type: 'string',
              description: 'A short descriptive key (e.g., "target_ip", "architecture_rule", "nmap_workflow").',
            },
            value: {
              type: 'string',
              description: 'The information or knowledge to remember.',
            },
            importance: {
              type: 'integer',
              description: 'Importance rating from 1 (transient) to 5 (critical architecture rule/fact). Default is 3.',
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
        description: 'Search persistent memory via Hybrid RRF Search (BM25 keyword + vector similarity + Ebbinghaus recency decay).',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find relevant memories.',
            },
            category: {
              type: 'string',
              enum: ['episodic', 'semantic', 'procedural', 'working', 'target', 'credential', 'finding', 'vulnerability', 'network', 'note', 'tool_config'],
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
        name: 'get_memory_stats',
        description: 'Get AgentMemory Engine stats, total stored items, category breakdown, and top-recalled memories.',
        parameters: {
          type: 'object',
          properties: {},
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
        name: 'send_file_to_telegram',
        description: 'Sends a file from the server filesystem to the active Telegram chat. Supports images (jpg, png, gif, webp), videos (mp4, mov, avi), audio (mp3, wav, flac), and any other file type as a document. Only files in workspace/ or /tmp/ can be sent. Use this when the user asks to see a file, screenshot, image, audio clip, or video.',
        parameters: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path to the file. Can be relative to project root (e.g. workspace/report.pdf) or absolute.'
            },
            caption: {
              type: 'string',
              description: 'Optional caption to display under the file in Telegram.'
            }
          },
          required: ['file_path']
        }
      }
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
            open_new_window: {
              type: 'boolean',
              description: 'If true, automatically pops out the preview into a new browser window/tab instead of just showing it in the side panel. Use this for full-page apps or when you want more freedom for the visualization.',
              default: false,
            },
          },
          required: ['html_content', 'title'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'analyze_target_graph',
        description: 'Autonomously generate and visualize an interactive network or structural graph for a given target, displaying it in a new window for the user.',
        parameters: {
          type: 'object',
          properties: {
            target_name: {
              type: 'string',
              description: 'The name or IP of the target to analyze.',
            },
            nodes: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of node names (e.g., open ports, subdomains, related services) to include in the graph.',
            },
            edges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  source: { type: 'string' },
                  target: { type: 'string' },
                  label: { type: 'string' }
                },
                required: ['source', 'target']
              },
              description: 'Optional list of edges defining complex relationships between nodes or the target.',
            },
          },
          required: ['target_name', 'nodes'],
        },
      },
    },

    {
      type: 'function',
      function: {
        name: 'ruflo_agent_swarm',
        description: 'Initialize and execute an autonomous multi-agent swarm using the Ruflo platform to achieve a complex goal. Use this for advanced, multi-step, multi-agent tasks.',
        parameters: {
          type: 'object',
          properties: {
            goal: {
              type: 'string',
              description: 'The complex objective or task for the swarm to execute.',
            },
          },
          required: ['goal'],
        },
      },
    },

    // ─── Internet Crawling Tools (Agent Reach Zero-Config) ───

    {
      type: 'function',
      function: {
        name: 'jina_read_url',
        description: 'Read any URL on the internet and get clean, readable Markdown content. Uses Jina Reader — zero config, free, no API key needed. Great for reading articles, docs, blog posts, and any webpage. Returns structured Markdown instead of raw HTML.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to read (e.g., "https://example.com/article").',
            },
            max_length: {
              type: 'integer',
              description: 'Maximum content length in characters (default: 50000).',
              default: 50000,
            },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'youtube_search',
        description: 'Search YouTube for videos matching a query. Returns video titles, channels, durations, view counts, and URLs. Zero config — uses yt-dlp.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query (e.g., "python tutorial for beginners").',
            },
            max_results: {
              type: 'integer',
              description: 'Maximum number of results (default: 10, max: 25).',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'youtube_get_subtitles',
        description: 'Extract subtitles/captions from a YouTube video. Returns the full transcript text. Great for summarizing videos, finding specific information in video content. Zero config — uses yt-dlp.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The YouTube video URL (e.g., "https://www.youtube.com/watch?v=dQw4w9WgXcQ").',
            },
            language: {
              type: 'string',
              description: 'Subtitle language code (default: "en"). Use "zh" for Chinese, "ja" for Japanese, etc.',
              default: 'en',
            },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'rss_read_feed',
        description: 'Read and parse an RSS or Atom feed. Returns structured entries with titles, links, dates, and summaries. Zero config, works with any RSS/Atom URL.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The RSS/Atom feed URL to read.',
            },
            max_items: {
              type: 'integer',
              description: 'Maximum number of items to return (default: 20).',
              default: 20,
            },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'v2ex_browse',
        description: 'Browse V2EX tech community. Read hot topics, latest posts, specific topics with replies, or browse by node (category). Zero config, public API, no auth needed.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['hot', 'latest', 'topic', 'node'],
              description: 'What to browse: "hot" (trending), "latest" (newest), "topic" (specific topic by ID), "node" (topics in a category).',
              default: 'hot',
            },
            topic_id: {
              type: 'integer',
              description: 'Topic ID — required when action is "topic".',
            },
            node_name: {
              type: 'string',
              description: 'Node/category name — required when action is "node" (e.g., "python", "linux", "jobs", "apple").',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'social_media_crawl',
        description: 'Crawl social media platforms using user-configured cookies. Supports Twitter/X, Reddit, XiaoHongShu (小红书), LinkedIn, and Instagram. Cookies must be configured in Settings → Agent Reach first. Use for searching, reading posts, profiles, and comments.',
        parameters: {
          type: 'object',
          properties: {
            platform: {
              type: 'string',
              enum: ['twitter', 'reddit', 'xiaohongshu', 'linkedin', 'instagram'],
              description: 'The social media platform to crawl.',
            },
            action: {
              type: 'string',
              enum: ['read', 'search'],
              description: '"read" = read a specific URL. "search" = search the platform.',
              default: 'read',
            },
            url: {
              type: 'string',
              description: 'URL to read — required when action is "read" (e.g., a tweet URL, Reddit post URL, etc.).',
            },
            query: {
              type: 'string',
              description: 'Search query — required when action is "search".',
            },
            max_results: {
              type: 'integer',
              description: 'Maximum number of search results (default: 10).',
              default: 10,
            },
          },
          required: ['platform'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'twitter_crawl',
        description: '🔍 Dedicated Twitter/X Tool. Search tweets by keyword or read specific tweet URLs and user profiles. Returns full tweet text, author handles, timestamps, likes, retweets, and links. Works zero-config out of the box (guest tokens + syndication API).',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['search', 'read'],
              description: '"search" = search Twitter/X for a keyword. "read" = read a specific Tweet URL or profile URL.',
              default: 'search',
            },
            query: {
              type: 'string',
              description: 'Search query (e.g., "AI agents", "cybersecurity news"). Required if action is "search".',
            },
            url: {
              type: 'string',
              description: 'Tweet URL or user profile URL (e.g., "https://x.com/user/status/123456789" or "https://x.com/elonmusk"). Required if action is "read".',
            },
            max_results: {
              type: 'integer',
              description: 'Maximum number of tweets to return (default: 10).',
              default: 10,
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'reddit_crawl',
        description: '📖 Dedicated Reddit Tool. Search subreddits and Reddit posts by keyword, or read specific Reddit threads and comments. Returns post titles, author handles, score, comment threads, and direct links.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['search', 'read'],
              description: '"search" = search Reddit for a topic. "read" = read a specific Reddit post URL.',
              default: 'search',
            },
            query: {
              type: 'string',
              description: 'Search query (e.g., "LLM frameworks", "Linux kernel"). Required if action is "search".',
            },
            url: {
              type: 'string',
              description: 'Reddit post URL to read. Required if action is "read".',
            },
            max_results: {
              type: 'integer',
              description: 'Maximum number of posts to return (default: 10).',
              default: 10,
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'linkedin_crawl',
        description: '💼 Dedicated LinkedIn Tool. Search LinkedIn for professional posts, articles, and job topics, or read specific LinkedIn post and profile URLs.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['search', 'read'],
              description: '"search" = search LinkedIn for keywords. "read" = read a specific LinkedIn page/post URL.',
              default: 'search',
            },
            query: {
              type: 'string',
              description: 'Search query (e.g., "AI jobs", "cloud architecture"). Required if action is "search".',
            },
            url: {
              type: 'string',
              description: 'LinkedIn post or profile URL. Required if action is "read".',
            },
            max_results: {
              type: 'integer',
              description: 'Maximum number of results (default: 10).',
              default: 10,
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'instagram_crawl',
        description: '📷 Dedicated Instagram Tool. Search Instagram for profiles, hashtag posts, and captions, or read specific Instagram post and profile URLs. Returns post captions, handles, likes, comments, and post links.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['search', 'read'],
              description: '"search" = search Instagram hashtags and profiles. "read" = read a specific Instagram post/profile URL.',
              default: 'search',
            },
            query: {
              type: 'string',
              description: 'Search query or hashtag (e.g., "python", "#tech"). Required if action is "search".',
            },
            url: {
              type: 'string',
              description: 'Instagram post or profile URL (e.g., "https://instagram.com/p/C12345/"). Required if action is "read".',
            },
            max_results: {
              type: 'integer',
              description: 'Maximum number of posts/profiles to return (default: 10).',
              default: 10,
            },
          },
          required: [],
        },
      },
    },
  ];
}


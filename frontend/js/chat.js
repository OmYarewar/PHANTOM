/**
 * Chat rendering and interaction logic
 * Enhanced with:
 *  - Real-time typing animation (character by character)
 *  - AI thinking/reasoning display (shown before the answer)
 */
window.Chat = {
  messagesEl: null,
  currentAssistantEl: null,
  currentContent: '',
  renderedContent: '',
  isStreaming: false,
  // Typing animation state
  typingQueue: [],
  typingTimer: null,
  typingSpeed: 22, // ms per character — slightly slower for visible effect
  // Thinking state
  currentThinkingEl: null,
  thinkingContent: '',

  init() {
    this.messagesEl = document.getElementById('messages');
  },

  clear() {
    this.messagesEl.innerHTML = '';
    this.currentAssistantEl = null;
    this.currentContent = '';
    this.renderedContent = '';
    this.currentThinkingEl = null;
    this.thinkingContent = '';
    this.typingQueue = [];
    if (this.typingTimer) {
      cancelAnimationFrame(this.typingTimer);
      this.typingTimer = null;
    }
  },

  showWelcome() {
    document.getElementById('welcome-screen').style.display = 'flex';
    this.messagesEl.style.display = 'none';
  },

  hideWelcome() {
    document.getElementById('welcome-screen').style.display = 'none';
    this.messagesEl.style.display = 'flex';
  },

  addUserMessage(content) {
    this.hideWelcome();
    const el = document.createElement('div');
    el.className = 'message user';
    el.textContent = content;
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
  },

  /**
   * Show AI thinking/reasoning text — displayed BEFORE the answer
   */
  addThinkingChunk(text) {
    this.hideWelcome();

    if (!this.currentThinkingEl) {
      this.currentThinkingEl = document.createElement('div');
      this.currentThinkingEl.className = 'message thinking';

      const label = document.createElement('span');
      label.className = 'thinking-label';
      label.textContent = '🧠 Thinking...';
      this.currentThinkingEl.appendChild(label);

      const contentEl = document.createElement('div');
      contentEl.className = 'thinking-content';
      this.currentThinkingEl.appendChild(contentEl);

      this.messagesEl.appendChild(this.currentThinkingEl);
      this.thinkingContent = '';
    }

    this.thinkingContent += text;
    const contentEl = this.currentThinkingEl.querySelector('.thinking-content');
    if (contentEl) {
      contentEl.textContent = this.thinkingContent;
    }
    this.scrollToBottom();
  },

  /**
   * End thinking — fade it slightly, update label
   */
  endThinking() {
    if (this.currentThinkingEl) {
      this.currentThinkingEl.classList.add('thinking-done');
      const label = this.currentThinkingEl.querySelector('.thinking-label');
      if (label) label.textContent = '🧠 Thought process';
    }
    this.currentThinkingEl = null;
    this.thinkingContent = '';
  },

  startAssistantMessage() {
    this.hideWelcome();

    // End any thinking block (thinking already shown above)
    this.endThinking();

    this.currentContent = '';
    this.renderedContent = '';
    this.typingQueue = [];
    this.currentAssistantEl = document.createElement('div');
    this.currentAssistantEl.className = 'message assistant';

    // Add typing indicator dots
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    this.currentAssistantEl.appendChild(typing);

    this.messagesEl.appendChild(this.currentAssistantEl);
    this.isStreaming = true;
    this.scrollToBottom();

    // Start the typing animation loop
    this._startTypingLoop();
  },

  appendChunk(text) {
    if (!this.currentAssistantEl) {
      this.startAssistantMessage();
    }

    // Remove typing indicator dots on first chunk
    const typing = this.currentAssistantEl.querySelector('.typing-indicator');
    if (typing) typing.remove();

    // Add text to full content buffer
    this.currentContent += text;

    // Queue only the NEW characters for typing animation
    for (const char of text) {
      this.typingQueue.push(char);
    }
  },

  /**
   * Typing animation loop — renders characters gradually, not all at once
   */
  _startTypingLoop() {
    let lastTime = 0;

    const animate = (timestamp) => {
      if (!this.isStreaming && this.typingQueue.length === 0) {
        return; // Stop the loop
      }

      if (this.typingQueue.length > 0) {
        const elapsed = timestamp - lastTime;

        // Adaptive speed: speed up when queue grows to prevent lag
        let speed = this.typingSpeed;
        if (this.typingQueue.length > 200) speed = 1;
        else if (this.typingQueue.length > 100) speed = 3;
        else if (this.typingQueue.length > 50) speed = 6;
        else if (this.typingQueue.length > 20) speed = 8;

        if (elapsed >= speed) {
          // Batch size also adapts to prevent falling behind
          const batchSize = Math.min(
            this.typingQueue.length,
            this.typingQueue.length > 200 ? 30 :
            this.typingQueue.length > 100 ? 15 :
            this.typingQueue.length > 50 ? 8 :
            this.typingQueue.length > 20 ? 4 : 2
          );

          for (let i = 0; i < batchSize; i++) {
            if (this.typingQueue.length > 0) {
              this.renderedContent += this.typingQueue.shift();
            }
          }

          // Re-render markdown with what we've typed so far
          if (this.currentAssistantEl) {
            this.currentAssistantEl.innerHTML = window.renderMarkdown(this.renderedContent);
          }

          this.scrollToBottom();
          lastTime = timestamp;
        }
      }

      this.typingTimer = requestAnimationFrame(animate);
    };

    this.typingTimer = requestAnimationFrame(animate);
  },

  endAssistantMessage() {
    if (this.currentAssistantEl) {
      // Remove any remaining typing indicator
      const typing = this.currentAssistantEl.querySelector('.typing-indicator');
      if (typing) typing.remove();

      // Flush any remaining queued characters
      if (this.typingQueue.length > 0) {
        this.renderedContent += this.typingQueue.join('');
        this.typingQueue = [];
      }

      // Final full render
      if (this.renderedContent || this.currentContent) {
        this.currentAssistantEl.innerHTML = window.renderMarkdown(this.renderedContent || this.currentContent);
      }
    }

    if (this.typingTimer) {
      cancelAnimationFrame(this.typingTimer);
      this.typingTimer = null;
    }

    this.currentAssistantEl = null;
    this.currentContent = '';
    this.renderedContent = '';
    this.isStreaming = false;

    // End thinking too
    this.endThinking();
  },

  addToolCall(data) {
    this.hideWelcome();
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.id = `tool-${data.id}`;

    const argsPreview = typeof data.args === 'object'
      ? (data.args.command || data.args.path || data.args.query || data.args.name || data.args.url || JSON.stringify(data.args).substring(0, 80))
      : '';

    card.innerHTML = `
      <div class="tool-card-header" onclick="this.nextElementSibling.classList.toggle('expanded')">
        <span>⚡ ${data.name}</span>
        <span style="flex:1;margin-left:8px;opacity:0.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escapeHtml(argsPreview)}</span>
        <span class="tool-status running"><span class="spinner"></span></span>
      </div>
      <div class="tool-card-body expanded"></div>
    `;

    this.messagesEl.appendChild(card);
    this.scrollToBottom();
  },

  /**
   * Live tool output — stream text into the tool card body in real-time
   */
  updateToolProgress(data) {
    const card = document.getElementById(`tool-${data.id}`);
    if (card) {
      const body = card.querySelector('.tool-card-body');
      if (body) {
        body.textContent += data.text;
        body.classList.add('expanded');
        // Auto-scroll the body to bottom
        body.scrollTop = body.scrollHeight;
      }
    }
    this.scrollToBottom();
  },

  addToolResult(data) {
    const card = document.getElementById(`tool-${data.id}`);
    if (card) {
      const status = card.querySelector('.tool-status');
      status.className = 'tool-status done';
      status.textContent = '✓';

      const body = card.querySelector('.tool-card-body');
      body.textContent = data.result || 'No output';
    }
    this.scrollToBottom();
  },

  addSystemMessage(content) {
    const el = document.createElement('div');
    el.className = 'message system';
    el.textContent = content;
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
  },

  addErrorMessage(content) {
    const el = document.createElement('div');
    el.className = 'message error';
    el.textContent = content;
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
  },

  /**
   * Render full conversation history from API
   */
  renderHistory(messages) {
    this.clear();
    if (!messages || messages.length === 0) {
      this.showWelcome();
      return;
    }

    this.hideWelcome();

    for (const msg of messages) {
      if (msg.role === 'user') {
        const el = document.createElement('div');
        el.className = 'message user';
        el.textContent = msg.content;
        this.messagesEl.appendChild(el);
      } else if (msg.role === 'assistant') {
        if (msg.content) {
          // Strip <think> blocks and show them before the answer
          let displayContent = msg.content;
          const thinkMatch = displayContent.match(/<think>([\s\S]*?)<\/think>/);
          if (thinkMatch) {
            const thinkEl = document.createElement('div');
            thinkEl.className = 'message thinking thinking-done';
            thinkEl.innerHTML = `<span class="thinking-label">🧠 Thought process</span><div class="thinking-content">${this.escapeHtml(thinkMatch[1].trim())}</div>`;
            this.messagesEl.appendChild(thinkEl);
            displayContent = displayContent.replace(/<think>[\s\S]*?<\/think>/, '').trim();
          }

          if (displayContent) {
            const el = document.createElement('div');
            el.className = 'message assistant';
            el.innerHTML = window.renderMarkdown(displayContent);
            this.messagesEl.appendChild(el);
          }
        }
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            let args = {};
            try { args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments; } catch {}
            const argsPreview = args.command || args.path || args.query || args.name || '';
            const card = document.createElement('div');
            card.className = 'tool-card';
            card.innerHTML = `
              <div class="tool-card-header" onclick="this.nextElementSibling.classList.toggle('expanded')">
                <span>⚡ ${tc.function.name}</span>
                <span style="flex:1;margin-left:8px;opacity:0.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escapeHtml(argsPreview)}</span>
                <span class="tool-status done">✓</span>
              </div>
              <div class="tool-card-body">Loading...</div>
            `;
            this.messagesEl.appendChild(card);
          }
        }
      } else if (msg.role === 'tool') {
        const cards = this.messagesEl.querySelectorAll('.tool-card');
        const lastCard = cards[cards.length - 1];
        if (lastCard) {
          const body = lastCard.querySelector('.tool-card-body');
          if (body) body.textContent = msg.content || 'No output';
        }
      }
    }
    this.scrollToBottom();
  },

  scrollToBottom() {
    const chatArea = document.getElementById('chat-area');
    requestAnimationFrame(() => {
      chatArea.scrollTop = chatArea.scrollHeight;
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
};

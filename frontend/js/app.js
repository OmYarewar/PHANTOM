/**
 * PHANTOM — Main Application Controller
 * Handles WebSocket, conversation management, and UI orchestration
 * Enhanced with: stop button, sudo modal, thinking display
 */
(function() {
  'use strict';

  // ─── State ───
  let ws = null;
  let currentConversationId = null;
  let conversations = [];
  let isProcessing = false;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 10;

  // ─── DOM References ───
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const stopBtn = document.getElementById('stop-btn');
  const newChatBtn = document.getElementById('new-chat-btn');
  const convList = document.getElementById('conversation-list');
  const searchInput = document.getElementById('search-conversations');
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');
  const connectionBadge = document.getElementById('connection-status');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');

  // ─── Initialize ───
  Chat.init();
  Settings.init();
  Management.init();
  initMatrix();
  connectWebSocket();
  loadConversations();
  checkSudoStatus();

  // ─── WebSocket ───
  function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('⚡ WebSocket connected');
      setStatus(true);
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setStatus(false);
      attemptReconnect();
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT) return;
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    setTimeout(connectWebSocket, delay);
  }

  function setStatus(online) {
    if (online) {
      statusDot.className = 'status-dot online';
      statusText.textContent = 'Connected';
      connectionBadge.className = 'connection-badge online';
      connectionBadge.textContent = '● Online';
    } else {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Disconnected';
      connectionBadge.className = 'connection-badge offline';
      connectionBadge.textContent = '● Offline';
    }
  }

  // ─── Message Handler ───
  function handleMessage(msg) {
    // Session isolation: only render messages for the active conversation
    if (msg.conversationId && currentConversationId && msg.conversationId !== currentConversationId) {
      // Exception: conversation_created sets the ID, title_updated refreshes list
      if (msg.type !== 'conversation_created' && msg.type !== 'title_updated' && msg.type !== 'pong') {
        return; // Ignore messages from other sessions
      }
    }

    switch (msg.type) {
      case 'conversation_created':
        currentConversationId = msg.conversationId;
        loadConversations();
        break;

      case 'response_start':
        isProcessing = true;
        updateButtons();
        Chat.startAssistantMessage();
        break;

      case 'thinking':
        Chat.addThinkingChunk(msg.content);
        break;

      case 'chunk':
        Chat.appendChunk(msg.content);
        break;

      case 'tool_call':
        Chat.endAssistantMessage();
        Chat.addToolCall(msg);
        break;

      case 'tool_progress':
        Chat.updateToolProgress(msg);
        break;

      case 'tool_result':
        Chat.addToolResult(msg);
        break;

      case 'response_end':
        Chat.endAssistantMessage();
        isProcessing = false;
        updateButtons();
        break;

      case 'title_updated':
        loadConversations();
        break;

      case 'error':
        Chat.addErrorMessage(msg.message);
        isProcessing = false;
        updateButtons();
        break;

      case 'pong':
        break;
    }
  }

  // ─── Send Message ───
  function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || isProcessing) return;

    Chat.addUserMessage(content);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    updateButtons();

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'chat',
        content,
        conversationId: currentConversationId,
      }));
    } else {
      Chat.addErrorMessage('Not connected to server. Trying to reconnect...');
      connectWebSocket();
    }
  }

  // ─── Stop AI ───
  function stopAI() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop' }));
      Chat.addSystemMessage('⏹ Stop requested...');
    }
  }

  // ─── Button State Management ───
  function updateButtons() {
    if (isProcessing) {
      sendBtn.style.display = 'none';
      stopBtn.style.display = 'flex';
    } else {
      sendBtn.style.display = 'flex';
      stopBtn.style.display = 'none';
      sendBtn.disabled = !messageInput.value.trim();
    }
  }

  // ─── Conversations ───
  async function loadConversations() {
    try {
      const res = await fetch('/api/conversations');
      conversations = await res.json();
      renderConversationList();
    } catch {}
  }

  function renderConversationList(filter = '') {
    convList.innerHTML = '';
    const filtered = filter
      ? conversations.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()))
      : conversations;

    for (const conv of filtered) {
      const el = document.createElement('div');
      el.className = `conv-item${conv.id === currentConversationId ? ' active' : ''}`;
      el.innerHTML = `
        <span class="conv-icon">💬</span>
        <span class="conv-title">${escapeHtml(conv.title)}</span>
        <button class="conv-delete" title="Delete">✕</button>
      `;

      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('conv-delete')) {
          deleteConversation(conv.id);
          return;
        }
        selectConversation(conv.id);
      });

      convList.appendChild(el);
    }
  }

  async function selectConversation(id) {
    currentConversationId = id;
    renderConversationList();

    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      Chat.renderHistory(data.messages);
    } catch {
      Chat.addErrorMessage('Failed to load conversation');
    }

    // Close mobile sidebar
    sidebar.classList.remove('open');
  }

  async function deleteConversation(id) {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (currentConversationId === id) {
        currentConversationId = null;
        Chat.clear();
        Chat.showWelcome();
      }
      loadConversations();
    } catch {}
  }

  function newChat() {
    currentConversationId = null;
    Chat.clear();
    Chat.showWelcome();
    renderConversationList();
    messageInput.focus();
  }

  // ─── Sudo Modal ───
  async function checkSudoStatus() {
    try {
      const res = await fetch('/api/system/info');
      const info = await res.json();
      if (!info.sudoConfigured) {
        showSudoModal();
      }
    } catch {}
  }

  function showSudoModal() {
    const modal = document.getElementById('sudo-modal');
    modal.style.display = 'flex';

    const passInput = document.getElementById('sudo-modal-password');
    const validateBtn = document.getElementById('sudo-modal-validate');
    const skipBtn = document.getElementById('sudo-modal-skip');
    const toggleEye = document.getElementById('sudo-modal-toggle-eye');
    const feedback = document.getElementById('sudo-modal-feedback');

    // Focus the input
    setTimeout(() => passInput.focus(), 100);

    // Toggle password visibility
    toggleEye.onclick = () => {
      passInput.type = passInput.type === 'password' ? 'text' : 'password';
    };

    // Enter key submits
    passInput.onkeydown = (e) => {
      if (e.key === 'Enter') validateSudoPassword();
    };

    // Validate button
    validateBtn.onclick = () => validateSudoPassword();

    // Skip button
    skipBtn.onclick = () => {
      modal.style.display = 'none';
    };

    async function validateSudoPassword() {
      const password = passInput.value.trim();
      if (!password) {
        feedback.className = 'sudo-modal-feedback error';
        feedback.textContent = '❌ Please enter a password';
        return;
      }

      validateBtn.disabled = true;
      validateBtn.textContent = '⏳ Validating...';
      feedback.className = 'sudo-modal-feedback';
      feedback.textContent = '';

      try {
        const res = await fetch('/api/sudo/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();

        if (data.valid) {
          feedback.className = 'sudo-modal-feedback success';
          feedback.textContent = '✅ ' + data.message;
          setTimeout(() => {
            modal.style.display = 'none';
          }, 1000);
        } else {
          feedback.className = 'sudo-modal-feedback error';
          feedback.textContent = '❌ ' + data.message;
        }
      } catch (err) {
        feedback.className = 'sudo-modal-feedback error';
        feedback.textContent = '❌ Connection error: ' + err.message;
      }

      validateBtn.disabled = false;
      validateBtn.textContent = '🔓 Validate & Grant Access';
    }
  }

  // ─── Input Handling ───
  messageInput.addEventListener('input', () => {
    updateButtons();
    autoResize();
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage();
    }
    // Also send on Enter (no modifier) if single line
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const lines = messageInput.value.split('\n').length;
      if (lines <= 1) {
        e.preventDefault();
        sendMessage();
      }
    }
  });

  sendBtn.addEventListener('click', sendMessage);
  stopBtn.addEventListener('click', stopAI);
  newChatBtn.addEventListener('click', newChat);

  searchInput.addEventListener('input', () => {
    renderConversationList(searchInput.value);
  });

  sidebarToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  function autoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
  }

  // ─── Matrix Background (very subtle) ───
  function initMatrix() {
    const canvas = document.getElementById('matrix-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const chars = '01';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = new Array(columns).fill(1);

    function draw() {
      ctx.fillStyle = 'rgba(13, 13, 13, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#22c55e';
      ctx.font = `${fontSize}px JetBrains Mono, monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.985) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }

    setInterval(draw, 80);
  }

  // ─── Keepalive ───
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);

  // ─── Helpers ───
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();

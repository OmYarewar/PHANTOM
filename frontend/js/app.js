/**
 * PHANTOM — Main Application Controller
 * Handles WebSocket, conversation management, and UI orchestration
 * New: Image OSINT (drag & drop person image → AI web search)
 * Fixed: Auto-scroll
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

  // Pending image for OSINT (base64 data URL)
  let pendingImage = null;
  let pendingImageName = '';

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
  initImageDrop();

  // ─── WebSocket ───
  // ─── Preview Panel Logic ───
  let lastPreviewHtml = '';
  const previewPanel = document.getElementById('preview-panel');
  const previewIframe = document.getElementById('preview-iframe');
  const previewTitle = document.getElementById('preview-title');

  window.showPreview = function showPreview(htmlContent, title) {
    if (!previewPanel) return;
    lastPreviewHtml = htmlContent;

    if (title) previewTitle.textContent = title;

    // Instead of directly writing to the document (which gets blocked without allow-same-origin),
    // we use a Data URI or srcdoc to safely render the content in the sandboxed iframe.
    previewIframe.srcdoc = htmlContent;

    previewPanel.classList.remove('hidden');

    // Attempt to shrink chat width so they can be side-by-side on large screens
    if (window.innerWidth > 1000) {
      document.querySelector('.main-content').style.width = '55vw';
    }
  }

  function hidePreview() {
    if (!previewPanel) return;
    previewPanel.classList.add('hidden');
    document.querySelector('.main-content').style.width = '100%';
  }

  document.getElementById('preview-close-btn')?.addEventListener('click', hidePreview);
  document.getElementById('preview-refresh-btn')?.addEventListener('click', () => {
    if (lastPreviewHtml) showPreview(lastPreviewHtml, previewTitle.textContent);
  });

  // ─── WebSocket ───
  function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setStatus(true);
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    };

    ws.onclose = () => {
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
      if (msg.type !== 'conversation_created' && msg.type !== 'title_updated' && msg.type !== 'pong') {
        return;
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
          if (msg.name === 'show_preview_window') {
            try {
              const resObj = typeof msg.result === 'string' ? JSON.parse(msg.result) : msg.result;
              if (resObj.html_content) {
                window.showPreview(resObj.html_content, resObj.title || 'Preview');
                // modify msg.result to only show success message in chat
                msg.result = resObj.message;
              }
            } catch (e) {
              console.error('Failed to parse show_preview_window result:', e);
            }
          }
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
    if ((!content && !pendingImage) || isProcessing) return;

    let finalContent = content;

    if (pendingImage) {
      // Build OSINT prompt with base64 image encoded as data URL
      const osintPrompt = content
        ? content
        : `I'm providing an image of a person for OSINT research. Please analyze this image and:
1. Describe physical features visible (age estimate, distinctive features, etc.)
2. Search the web for people matching this description
3. Use search_web to find any public information about this person
4. Check social media presence using search_web (LinkedIn, Twitter, Instagram, Facebook)
5. Use scrapling_fetch for deeper investigation of any relevant pages found
6. Compile all findings into a comprehensive OSINT report

Start the investigation immediately!`;

      Chat.addUserMessage(finalContent || '🖼️ Image provided for OSINT analysis', pendingImage);

      // Send with image context embedded in message
      const imageMsg = `${osintPrompt}\n\n[IMAGE ATTACHED: ${pendingImageName || 'image.png'} — base64 encoded image of person to investigate]\nImage data: ${pendingImage}`;

      messageInput.value = '';
      messageInput.style.height = 'auto';
      clearPendingImage();
      updateButtons();

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'chat',
          content: imageMsg,
          conversationId: currentConversationId,
        }));
      } else {
        Chat.addErrorMessage('Not connected to server. Trying to reconnect...');
        connectWebSocket();
      }
      return;
    }

    Chat.addUserMessage(finalContent);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    updateButtons();

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'chat',
        content: finalContent,
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
      sendBtn.disabled = !messageInput.value.trim() && !pendingImage;
    }
  }

  // ─── Image Drop / OSINT ───
  function initImageDrop() {
    const inputArea = document.getElementById('input-area');
    const inputContainer = document.querySelector('.input-container');

    // Create image preview area
    const previewEl = document.createElement('div');
    previewEl.id = 'image-preview-bar';
    previewEl.className = 'image-preview-bar hidden';
    previewEl.innerHTML = `
      <div class="image-preview-inner">
        <span class="image-preview-icon">🖼️</span>
        <img id="image-preview-thumb" src="" alt="preview" class="image-preview-thumb"/>
        <span id="image-preview-name" class="image-preview-name"></span>
        <span class="image-preview-badge">OSINT Ready</span>
        <button id="image-preview-remove" class="image-preview-remove" title="Remove image">✕</button>
      </div>
    `;
    inputArea.insertBefore(previewEl, inputArea.firstChild);

    document.getElementById('image-preview-remove').addEventListener('click', clearPendingImage);

    // ── Create hidden file input for click-to-upload ──
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.id = 'osint-file-input';
    document.body.appendChild(fileInput);
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) loadImageFile(file);
      fileInput.value = '';
    });

    // ── Image button in input bar ──
    const imageBtn = document.createElement('button');
    imageBtn.id = 'image-osint-btn';
    imageBtn.className = 'image-osint-btn';
    imageBtn.title = 'Drop image for OSINT analysis';
    imageBtn.innerHTML = '🖼️';
    imageBtn.addEventListener('click', () => fileInput.click());
    inputContainer.insertBefore(imageBtn, inputContainer.querySelector('textarea'));

    // ── Drag and Drop on entire chat area & input ──
    const dropZone = document.getElementById('chat-area');

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        loadImageFile(files[0]);
      }
    });

    // Also allow paste of images
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) loadImageFile(file);
          break;
        }
      }
    });
  }

  function loadImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      pendingImage = e.target.result;
      pendingImageName = file.name;
      showImagePreview(e.target.result, file.name);
      updateButtons();
      messageInput.focus();
    };
    reader.readAsDataURL(file);
  }

  function showImagePreview(dataUrl, name) {
    const bar = document.getElementById('image-preview-bar');
    const thumb = document.getElementById('image-preview-thumb');
    const nameEl = document.getElementById('image-preview-name');
    thumb.src = dataUrl;
    nameEl.textContent = name || 'image.png';
    bar.classList.remove('hidden');
  }

  function clearPendingImage() {
    pendingImage = null;
    pendingImageName = '';
    const bar = document.getElementById('image-preview-bar');
    if (bar) bar.classList.add('hidden');
    const thumb = document.getElementById('image-preview-thumb');
    if (thumb) thumb.src = '';
    updateButtons();
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

    setTimeout(() => passInput.focus(), 100);

    toggleEye.onclick = () => {
      passInput.type = passInput.type === 'password' ? 'text' : 'password';
    };

    passInput.onkeydown = (e) => {
      if (e.key === 'Enter') validateSudoPassword();
    };

    validateBtn.onclick = () => validateSudoPassword();

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

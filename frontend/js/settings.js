/**
 * Settings panel logic
 * Added: AI Doctor — temporary AI to diagnose & fix system issues
 */
window.Settings = {
  panel: null,
  isOpen: false,

  init() {
    this.panel = document.getElementById('settings-panel');

    // Open/close
    document.getElementById('settings-btn').addEventListener('click', () => this.open());
    document.getElementById('welcome-settings-btn')?.addEventListener('click', () => this.open());
    document.getElementById('settings-close').addEventListener('click', () => this.close());
    document.getElementById('settings-overlay').addEventListener('click', () => this.close());

    // Temperature slider
    const tempSlider = document.getElementById('setting-temperature');
    const tempValue = document.getElementById('temperature-value');
    tempSlider.addEventListener('input', () => {
      tempValue.textContent = tempSlider.value;
    });

    // API key visibility toggle
    document.getElementById('toggle-api-key').addEventListener('click', () => {
      const input = document.getElementById('setting-api-key');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Sudo password visibility toggle
    document.getElementById('toggle-sudo-pass').addEventListener('click', () => {
      const input = document.getElementById('setting-sudo-password');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Test connection
    document.getElementById('test-connection').addEventListener('click', () => this.testConnection());

    // Save settings
    document.getElementById('save-settings').addEventListener('click', () => this.save());

    // AI Doctor button
    document.getElementById('ai-doctor-btn').addEventListener('click', () => this.openDoctor());

    // Load settings on init
    this.load();

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    // Init AI Doctor modal logic
    this._initDoctorModal();
  },

  open() {
    this.panel.classList.remove('hidden');
    this.isOpen = true;
  },

  close() {
    this.panel.classList.add('hidden');
    this.isOpen = false;
  },

  async load() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();

      document.getElementById('setting-base-url').value = data.baseUrl || '';
      document.getElementById('setting-api-key').value = data.apiKeySet ? '••••••••' : '';
      document.getElementById('setting-model').value = data.model || '';
      document.getElementById('setting-temperature').value = data.temperature || 0.7;
      document.getElementById('temperature-value').textContent = data.temperature || 0.7;
      document.getElementById('setting-max-tokens').value = data.maxTokens || 4096;
      document.getElementById('setting-workspace').value = data.workspace || '';

      // Update model badge
      document.getElementById('current-model').textContent = data.model || 'No Model';
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  },

  async save() {
    const settings = {
      baseUrl: document.getElementById('setting-base-url').value,
      model: document.getElementById('setting-model').value,
      temperature: parseFloat(document.getElementById('setting-temperature').value),
      maxTokens: parseInt(document.getElementById('setting-max-tokens').value),
      workspace: document.getElementById('setting-workspace').value,
    };

    const apiKey = document.getElementById('setting-api-key').value;
    if (apiKey && !apiKey.startsWith('••')) {
      settings.apiKey = apiKey;
    }

    const sudoPassword = document.getElementById('setting-sudo-password').value;
    if (sudoPassword) {
      settings.sudoPassword = sudoPassword;
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        document.getElementById('current-model').textContent = settings.model || 'No Model';

        const btn = document.getElementById('save-settings');
        btn.textContent = '✓ Saved';
        btn.style.background = '#16a34a';
        setTimeout(() => {
          btn.textContent = '💾 Save Settings';
          btn.style.background = '';
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  },

  async testConnection() {
    const resultEl = document.getElementById('test-result');
    resultEl.className = 'test-result';
    resultEl.textContent = 'Testing...';

    await this.save();

    try {
      const res = await fetch('/api/settings/test', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        resultEl.className = 'test-result success';
        resultEl.textContent = `✓ ${data.message}`;
      } else {
        resultEl.className = 'test-result error';
        resultEl.textContent = `✗ ${data.message}`;
      }
    } catch (err) {
      resultEl.className = 'test-result error';
      resultEl.textContent = `✗ ${err.message}`;
    }

    setTimeout(() => { resultEl.textContent = ''; }, 5000);
  },

  // ─── AI Doctor ───
  openDoctor() {
    const modal = document.getElementById('ai-doctor-modal');
    modal.classList.remove('hidden');
    // Reset to config screen
    document.getElementById('doctor-config-screen').style.display = 'block';
    document.getElementById('doctor-chat-screen').style.display = 'none';
  },

  _initDoctorModal() {
    const modal = document.getElementById('ai-doctor-modal');
    const overlay = document.getElementById('ai-doctor-overlay');
    const closeBtn = document.getElementById('ai-doctor-close');
    const startBtn = document.getElementById('doctor-start-btn');
    const sendBtn = document.getElementById('doctor-send-btn');
    const stopBtn = document.getElementById('doctor-stop-btn');
    const chatInput = document.getElementById('doctor-chat-input');

    overlay?.addEventListener('click', () => modal.classList.add('hidden'));
    closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
    });

    // Doctor API key toggle
    document.getElementById('doctor-toggle-key')?.addEventListener('click', () => {
      const inp = document.getElementById('doctor-api-key');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    let doctorAbortController = null;

    startBtn?.addEventListener('click', async () => {
      const baseUrl = document.getElementById('doctor-base-url').value.trim() || 'https://api.openai.com/v1';
      const apiKey = document.getElementById('doctor-api-key').value.trim();
      const model = document.getElementById('doctor-model').value.trim() || 'gpt-4o';

      if (!apiKey) {
        document.getElementById('doctor-config-feedback').textContent = '⚠️ API Key is required';
        return;
      }

      document.getElementById('doctor-config-feedback').textContent = '';
      document.getElementById('doctor-config-screen').style.display = 'none';
      document.getElementById('doctor-chat-screen').style.display = 'flex';

      // Store temp config
      modal._doctorConfig = { baseUrl, apiKey, model };

      // Clear chat
      const messagesEl = document.getElementById('doctor-messages');
      messagesEl.innerHTML = '';

      // Auto-start diagnosis
      await runDoctorMessage('Diagnose my system: check for common issues, broken services, high CPU/memory usage, disk space problems, failed systemd services, and any security concerns. Then suggest and apply fixes where safe to do automatically.', modal._doctorConfig);
    });

    sendBtn?.addEventListener('click', () => {
      const msg = chatInput.value.trim();
      if (!msg) return;
      chatInput.value = '';
      runDoctorMessage(msg, modal._doctorConfig);
    });

    chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const msg = chatInput.value.trim();
        if (msg) {
          chatInput.value = '';
          runDoctorMessage(msg, modal._doctorConfig);
        }
      }
    });

    stopBtn?.addEventListener('click', () => {
      if (doctorAbortController) {
        doctorAbortController.abort();
        doctorAbortController = null;
      }
      sendBtn.disabled = false;
      stopBtn.style.display = 'none';
      sendBtn.style.display = 'flex';
    });

    async function runDoctorMessage(userMsg, config) {
      const messagesEl = document.getElementById('doctor-messages');

      // Show user message
      const userEl = document.createElement('div');
      userEl.className = 'doctor-msg doctor-msg-user';
      userEl.textContent = userMsg;
      messagesEl.appendChild(userEl);
      scrollDoctorToBottom();

      // Show thinking indicator
      const thinkEl = document.createElement('div');
      thinkEl.className = 'doctor-msg doctor-msg-ai doctor-thinking';
      thinkEl.innerHTML = '<span class="spinner"></span> Dr. AI is analyzing...';
      messagesEl.appendChild(thinkEl);
      scrollDoctorToBottom();

      sendBtn.disabled = true;
      sendBtn.style.display = 'none';
      stopBtn.style.display = 'flex';

      doctorAbortController = new AbortController();

      try {
        const systemPrompt = `You are Dr. AI — an expert system doctor and Linux/system administrator AI. 
You diagnose and fix system problems. You can:
- Analyze system logs, processes, and services
- Identify performance issues, broken services, security problems
- Execute diagnostic commands via the PHANTOM server
- Suggest and apply fixes autonomously
- Explain everything clearly to the user

Be proactive, thorough, and fix issues automatically when safe to do so.
Use your tool access through PHANTOM's execute_command and read_file capabilities when needed.`;

        const response = await fetch('/api/doctor/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMsg,
            config,
            systemPrompt,
          }),
          signal: doctorAbortController.signal,
        });

        thinkEl.remove();

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        // Stream the response
        const aiEl = document.createElement('div');
        aiEl.className = 'doctor-msg doctor-msg-ai';
        aiEl.innerHTML = '';
        messagesEl.appendChild(aiEl);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content || '';
                if (text) {
                  fullText += text;
                  aiEl.innerHTML = window.renderMarkdown(fullText);
                  scrollDoctorToBottom();
                }
              } catch {}
            }
          }
        }

      } catch (err) {
        thinkEl.remove();
        if (err.name !== 'AbortError') {
          const errEl = document.createElement('div');
          errEl.className = 'doctor-msg doctor-msg-error';
          errEl.textContent = '❌ Error: ' + err.message;
          messagesEl.appendChild(errEl);
          scrollDoctorToBottom();
        }
      }

      doctorAbortController = null;
      sendBtn.disabled = false;
      sendBtn.style.display = 'flex';
      stopBtn.style.display = 'none';
    }

    function scrollDoctorToBottom() {
      const messagesEl = document.getElementById('doctor-messages');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        });
      });
    }
  },
};

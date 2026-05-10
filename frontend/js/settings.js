/**
 * Settings panel logic
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

    // Load settings on init
    this.load();

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
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
        // Update model badge
        document.getElementById('current-model').textContent = settings.model || 'No Model';

        // Flash save button green briefly
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

    // First save current settings
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
};

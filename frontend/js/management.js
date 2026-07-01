import { renderSkillManager } from './skill-manager.js';
import { renderAnalysisDashboard } from './analysis-dashboard.js';

/**
 * Management panel — MCP Servers + Skills
 */
window.Management = {
  panel: null,
  isOpen: false,

  init() {
    this.panel = document.getElementById('manage-panel');
    if (!this.panel) return;

    renderSkillManager('skill-manager-root');
    renderAnalysisDashboard('analysis-dashboard-root');

    // Open/close
    document.getElementById('manage-btn')?.addEventListener('click', () => this.open());
    document.getElementById('manage-close')?.addEventListener('click', () => this.close());
    document.getElementById('manage-overlay')?.addEventListener('click', () => this.close());

    // Tab switching
    this.panel.querySelectorAll('.manage-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.panel.querySelectorAll('.manage-tab').forEach(t => t.classList.remove('active'));
        this.panel.querySelectorAll('.manage-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab)?.classList.add('active');
      });
    });

    // MCP: Add button shows form
    document.getElementById('manage-add-mcp')?.addEventListener('click', () => {
      document.getElementById('mcp-add-form').style.display = 'block';
    });

    // MCP: Cancel form
    document.getElementById('mcp-cancel-btn')?.addEventListener('click', () => {
      document.getElementById('mcp-add-form').style.display = 'none';
    });

    // MCP: Save new server
    document.getElementById('mcp-save-btn')?.addEventListener('click', () => this.saveMCP());

    // Skills: Zip upload
    document.getElementById('skill-zip-input')?.addEventListener('change', (e) => this.uploadSkill(e));

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    // Also wire up the old settings panel MCP button
    document.getElementById('add-mcp-btn')?.addEventListener('click', () => {
      this.open();
    });
  },

  open() {
    this.panel.classList.remove('hidden');
    this.isOpen = true;
    this.loadMCPServers();
    this.loadSkills();
  },

  close() {
    this.panel.classList.add('hidden');
    this.isOpen = false;
  },

  // ─── MCP Servers ───
  async loadMCPServers() {
    try {
      const res = await fetch('/api/mcp/servers');
      const servers = await res.json();
      const list = document.getElementById('manage-mcp-list');
      if (!servers.length) {
        list.innerHTML = '<p class="empty-msg">No MCP servers configured yet</p>';
        return;
      }
      list.innerHTML = servers.map(s => `
        <div class="manage-item">
          <div class="manage-item-info">
            <strong>🔌 ${this.esc(s.name || 'Unnamed')}</strong>
            <small>${this.esc(s.command || s.url || '')}</small>
            <span class="badge">${s.transport || 'stdio'}</span>
          </div>
          <button class="btn-icon-sm danger" onclick="Management.deleteMCP('${s.id}')" title="Remove" aria-label="Remove MCP server">🗑️</button>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
      window.Toast.show('Failed to load MCP servers', 'error');
      document.getElementById('manage-mcp-list').innerHTML = '<p class="empty-msg">Failed to load MCP servers</p>';
    }
  },

  async saveMCP() {
    const name = document.getElementById('mcp-name-input').value.trim();
    const command = document.getElementById('mcp-command-input').value.trim();
    const transport = document.getElementById('mcp-transport-input').value;

    if (!name || !command) return;

    const saveBtn = document.getElementById('mcp-save-btn');
    const cancelBtn = document.getElementById('mcp-cancel-btn');
    const originalText = saveBtn.textContent;

    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await fetch('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, command, transport }),
      });
      document.getElementById('mcp-add-form').style.display = 'none';
      document.getElementById('mcp-name-input').value = '';
      document.getElementById('mcp-command-input').value = '';
      this.loadMCPServers();
    } catch (err) {
      console.error('Failed to save MCP server:', err);
      window.Toast.show('Failed to save MCP server', 'error');
    } finally {
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  },

  async deleteMCP(id) {
    window.Toast.confirm('Are you sure you want to remove this MCP server?', async () => {
      try {
        await fetch(`/api/mcp/servers/${id}`, { method: 'DELETE' });
        this.loadMCPServers();
      } catch (err) {
        console.error('Failed to delete MCP server:', err);
        window.Toast.show('Failed to delete MCP server', 'error');
      }
    });
  },

  // ─── Skills ───
  async loadSkills() {
    try {
      const res = await fetch('/api/skills');
      const skills = await res.json();
      const list = document.getElementById('manage-skills-list');
      if (!skills.length) {
        list.innerHTML = '<p class="empty-msg">No skills installed. Import a .zip or let the AI create them.</p>';
        return;
      }
      list.innerHTML = skills.map(s => `
        <div class="manage-item">
          <div class="manage-item-info">
            <strong>🧠 ${this.esc(s.name)}</strong>
            <small>${this.esc(s.description || s.files?.join(', ') || 'No description')}</small>
          </div>
          <button class="btn-icon-sm danger" onclick="Management.deleteSkill('${this.esc(s.name)}')" title="Remove" aria-label="Remove Skill">🗑️</button>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
      window.Toast.show('Failed to load skills', 'error');
      document.getElementById('manage-skills-list').innerHTML = '<p class="empty-msg">Failed to load skills</p>';
    }
  },

  async uploadSkill(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileInput = document.getElementById('skill-zip-input');
    fileInput.disabled = true;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/skills/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        this.loadSkills();
        window.Toast.show(data.message || 'Skill uploaded successfully', 'success');
      } else {
        window.Toast.show('Upload failed: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      window.Toast.show('Upload error: ' + err.message, 'error');
    } finally {
      fileInput.disabled = false;
    }
    event.target.value = ''; // Reset file input
  },

  async deleteSkill(name) {
    window.Toast.confirm(`Delete skill "${name}"?`, async () => {
      try {
        await fetch(`/api/skills/${encodeURIComponent(name)}`, { method: 'DELETE' });
        this.loadSkills();
      } catch (err) {
        console.error('Failed to delete skill:', err);
        window.Toast.show('Failed to delete skill', 'error');
      }
    });
  },

  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};

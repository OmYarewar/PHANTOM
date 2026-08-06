/**
 * Workspace File Explorer Right Panel Logic
 * Features:
 * - Animated opening & closing (slideInRight / slideOutRight)
 * - Tree view for workspace files & folders
 * - Live file content preview
 * - Auto-refresh when AI creates/modifies files
 */
window.WorkspaceExplorer = {
  panel: null,
  overlay: null,
  isOpen: false,

  init() {
    this.panel = document.getElementById('workspace-panel');
    this.overlay = document.getElementById('workspace-overlay');

    const toggleBtn = document.getElementById('workspace-toggle-btn');
    const closeBtn = document.getElementById('workspace-close-btn');
    const refreshBtn = document.getElementById('workspace-refresh-btn');

    toggleBtn?.addEventListener('click', () => this.toggle());
    closeBtn?.addEventListener('click', () => this.close());
    refreshBtn?.addEventListener('click', () => this.loadTree());
    this.overlay?.addEventListener('click', () => this.close());

    // Preview close button
    document.getElementById('preview-close-btn')?.addEventListener('click', () => {
      document.getElementById('workspace-preview-modal')?.classList.add('hidden');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const previewModal = document.getElementById('workspace-preview-modal');
        if (previewModal && !previewModal.classList.contains('hidden')) {
          previewModal.classList.add('hidden');
        } else if (this.isOpen) {
          this.close();
        }
      }
    });
  },

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  open() {
    if (!this.panel) return;
    this.isOpen = true;
    this.overlay?.classList.remove('hidden');
    this.panel.classList.remove('hidden', 'slide-out-right');
    this.panel.classList.add('slide-in-right');
    this.loadTree();
  },

  close() {
    if (!this.panel || !this.isOpen) return;
    this.isOpen = false;
    this.panel.classList.remove('slide-in-right');
    this.panel.classList.add('slide-out-right');
    this.overlay?.classList.add('hidden');

    setTimeout(() => {
      if (!this.isOpen) {
        this.panel.classList.add('hidden');
      }
    }, 280);
  },

  async loadTree() {
    const treeEl = document.getElementById('workspace-tree');
    if (!treeEl) return;

    treeEl.innerHTML = '<div class="workspace-loading">⏳ Loading workspace files...</div>';

    try {
      const res = await fetch('/api/workspace/files');
      const data = await res.json();

      if (data.success) {
        if (!data.tree || data.tree.length === 0) {
          treeEl.innerHTML = '<div class="workspace-empty">📁 Workspace is empty</div>';
          return;
        }
        treeEl.innerHTML = this.renderNodes(data.tree);
        this.attachTreeListeners();
      } else {
        treeEl.innerHTML = `<div class="workspace-error">❌ ${data.error}</div>`;
      }
    } catch (err) {
      treeEl.innerHTML = `<div class="workspace-error">❌ Error: ${err.message}</div>`;
    }
  },

  renderNodes(nodes, level = 0) {
    return `<ul class="tree-list level-${level}">` + nodes.map(node => {
      if (node.isDirectory) {
        return `
          <li class="tree-node directory">
            <div class="tree-item dir-item" data-path="${node.path}">
              <span class="folder-toggle">▼</span>
              <span class="tree-icon">📁</span>
              <span class="tree-name">${this.escapeHtml(node.name)}</span>
            </div>
            <div class="subtree">
              ${node.children ? this.renderNodes(node.children, level + 1) : ''}
            </div>
          </li>
        `;
      } else {
        const icon = this.getFileIcon(node.name);
        const sizeStr = this.formatSize(node.size);
        return `
          <li class="tree-node file">
            <div class="tree-item file-item" data-path="${node.path}">
              <span class="tree-icon">${icon}</span>
              <span class="tree-name">${this.escapeHtml(node.name)}</span>
              <span class="tree-size">${sizeStr}</span>
            </div>
          </li>
        `;
      }
    }).join('') + '</ul>';
  },

  attachTreeListeners() {
    const treeEl = document.getElementById('workspace-tree');
    if (!treeEl) return;

    // Folder toggle
    treeEl.querySelectorAll('.dir-item').forEach(dirItem => {
      dirItem.addEventListener('click', (e) => {
        const parentLi = dirItem.closest('.tree-node');
        const toggleSpan = dirItem.querySelector('.folder-toggle');
        const subtree = parentLi.querySelector('.subtree');

        if (subtree) {
          if (subtree.style.display === 'none') {
            subtree.style.display = 'block';
            if (toggleSpan) toggleSpan.textContent = '▼';
          } else {
            subtree.style.display = 'none';
            if (toggleSpan) toggleSpan.textContent = '▶';
          }
        }
      });
    });

    // File click -> Preview
    treeEl.querySelectorAll('.file-item').forEach(fileItem => {
      fileItem.addEventListener('click', () => {
        const path = fileItem.dataset.path;
        if (path) this.previewFile(path);
      });
    });
  },

  async previewFile(path) {
    const modal = document.getElementById('workspace-preview-modal');
    const nameEl = document.getElementById('preview-filename');
    const contentEl = document.getElementById('preview-content');
    if (!modal || !nameEl || !contentEl) return;

    nameEl.textContent = path;
    contentEl.textContent = 'Loading...';
    modal.classList.remove('hidden');

    try {
      const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.success) {
        contentEl.textContent = data.content;
      } else {
        contentEl.textContent = `Error: ${data.error}`;
      }
    } catch (err) {
      contentEl.textContent = `Error loading file: ${err.message}`;
    }
  },

  getFileIcon(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js': case 'jsx': case 'mjs': return '🟨';
      case 'ts': case 'tsx': return '🔷';
      case 'py': return '🐍';
      case 'html': case 'htm': return '🌐';
      case 'css': return '🎨';
      case 'json': return '📋';
      case 'md': return '📝';
      case 'sh': case 'bash': return '⚡';
      case 'sql': case 'db': return '💾';
      case 'png': case 'jpg': case 'jpeg': case 'svg': return '🖼️';
      default: return '📄';
    }
  },

  formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

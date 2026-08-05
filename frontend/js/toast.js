/**
 * Toast Notifications & Custom Confirmation UI (Accessible & Non-leaking)
 */

window.Toast = {
  activeConfirmation: null,
  previousActiveElement: null,

  init() {
    // Inject Toast Container with ARIA live region
    if (!document.getElementById('toast-container')) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      container.setAttribute('role', 'status');
      document.body.appendChild(container);
    }

    // Inject Confirm Modal with proper ARIA roles
    if (!document.getElementById('toast-confirm-modal')) {
      const modalHtml = `
        <div id="toast-confirm-modal" class="toast-confirm-modal hidden" role="alertdialog" aria-modal="true" aria-labelledby="toast-confirm-message">
          <div class="toast-confirm-overlay" id="toast-confirm-overlay"></div>
          <div class="toast-confirm-dialog" tabindex="-1">
            <div class="toast-confirm-body">
              <span class="toast-confirm-icon" aria-hidden="true">⚠️</span>
              <p id="toast-confirm-message" class="toast-confirm-message"></p>
            </div>
            <div class="toast-confirm-actions">
              <button type="button" id="toast-confirm-cancel" class="btn btn-secondary btn-sm" aria-label="Cancel">Cancel</button>
              <button type="button" id="toast-confirm-ok" class="btn btn-primary btn-sm danger-bg" aria-label="Confirm">Confirm</button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
  },

  show(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
    const icon = icons[type] || icons.info;

    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icon}</span>
      <span class="toast-msg">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  confirm(message, onConfirm) {
    const modal = document.getElementById('toast-confirm-modal');
    const overlay = document.getElementById('toast-confirm-overlay');
    const msgEl = document.getElementById('toast-confirm-message');
    const okBtn = document.getElementById('toast-confirm-ok');
    const cancelBtn = document.getElementById('toast-confirm-cancel');

    if (!modal) return;

    if (this.activeConfirmation) {
      this.activeConfirmation.cleanup();
    }

    this.previousActiveElement = document.activeElement;

    msgEl.textContent = message;
    modal.classList.remove('hidden');

    const handleOk = () => {
      cleanup();
      if (typeof onConfirm === 'function') onConfirm();
    };

    const handleCancel = () => cleanup();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Tab') {
        const focusables = [cancelBtn, okBtn];
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const cleanup = () => {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      overlay.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeyDown);
      this.activeConfirmation = null;

      if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
        this.previousActiveElement.focus();
      }
    };

    this.activeConfirmation = { cleanup };

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeyDown);

    cancelBtn.focus();
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

window.addEventListener('DOMContentLoaded', () => window.Toast.init());

/**
 * Lightweight Markdown renderer — no dependencies
 * Handles: headers, bold, italic, code, code blocks, links, lists, tables, blockquotes, hr
 */

// HTML entity map for escaping
const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

window.renderMarkdown = function(text) {
  if (!text) return '';

  // Escape HTML
  let html = text.replace(/[&<>]/g, match => escapeMap[match]);

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = 'cb-' + Math.random().toString(36).substr(2, 6);
    const header = lang
      ? `<div class="code-block-header"><span>${lang}</span><button class="copy-btn" onclick="copyCode('${id}')">Copy</button></div>`
      : `<div class="code-block-header"><span>code</span><button class="copy-btn" onclick="copyCode('${id}')">Copy</button></div>`;
    return `${header}<pre id="${id}"><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-:\s|]+\|)\n((?:\|.+\|\n?)*)/gm, (match, header, separator, body) => {
    const headers = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Headers
  html = html.replace(/^(#{1,4}) (.+)$/gm, (match, hashes, content) => `<h${hashes.length}>${content}</h${hashes.length}>`);

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Unordered lists
  html = html.replace(/^[\s]*[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs — wrap remaining plain text lines
  html = html.replace(/^(?!<[a-z/])((?!<).+)$/gm, '<p>$1</p>');

  // Clean up extra paragraph tags around block elements
  html = html.replace(/<p>(<(?:h[1-6]|ul|ol|li|table|pre|blockquote|hr|div)[^>]*>)/g, '$1');
  html = html.replace(/(<\/(?:h[1-6]|ul|ol|li|table|pre|blockquote|hr|div)>)<\/p>/g, '$1');

  return html;
};

window.copyCode = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = el.previousElementSibling?.querySelector('.copy-btn') ||
                el.parentElement?.querySelector('.copy-btn');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }
  });
};

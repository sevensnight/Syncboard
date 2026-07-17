const EMOJI_SHORTCUTS = ['😀', '😂', '😍', '👍', '🎉', '🔥'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initialsForName(name) {
  return String(name || '?').trim().slice(0, 1).toUpperCase() || '?';
}

function avatarColor(name) {
  const palette = [
    'bg-[#4f46e5]',
    'bg-[#059669]',
    'bg-[#e11d48]',
    'bg-[#0ea5e9]',
    'bg-[#d97706]',
    'bg-[#7c3aed]',
  ];
  const total = Array.from(String(name || '')).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[total % palette.length];
}

function createToastHtml({ title, description }) {
  return `<div class="sb-toast"><div class="sb-toast-dot"></div><div><p class="sb-toast-title">${escapeHtml(title)}</p><p class="sb-toast-desc">${escapeHtml(description)}</p></div></div>`;
}

function createIconSvg(paths) {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export {
  EMOJI_SHORTCUTS,
  avatarColor,
  clamp,
  createIconSvg,
  createToastHtml,
  escapeHtml,
  formatFileSize,
  formatTime,
  initialsForName,
};

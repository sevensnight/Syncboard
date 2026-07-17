const path = require('path');

function normalizeText(value, fallback = '', maxLength = 24) {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);

  return normalized || fallback;
}

function toSafeRoomSegment(roomId) {
  return normalizeText(roomId, 'lobby', 32)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'lobby';
}

function sanitizeFilename(filename) {
  const baseName = path.basename(String(filename || 'file'));
  const extension = path.extname(baseName).slice(0, 16);
  const nameWithoutExtension = path.basename(baseName, extension);
  const safeName = nameWithoutExtension
    .replace(/[^\p{L}\p{N}._()\- ]/gu, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'file';

  const safeExtension = extension.replace(/[^.\p{L}\p{N}]/gu, '').slice(0, 16);
  return `${safeName}${safeExtension}`;
}

module.exports = {
  normalizeText,
  sanitizeFilename,
  toSafeRoomSegment,
};

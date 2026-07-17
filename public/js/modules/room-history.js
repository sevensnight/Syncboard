const HISTORY_KEY = 'syncboard-room-history';
const MAX_HISTORY = 20;

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function writeHistory(items) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch (_error) {
  }
}

function touchRoomHistory(roomId, username = '') {
  const id = String(roomId || '').trim() || 'lobby';
  const now = new Date().toISOString();
  const next = readHistory().filter((item) => item.roomId !== id);
  next.unshift({
    roomId: id,
    username: String(username || '').trim(),
    lastVisitedAt: now,
  });
  writeHistory(next);
  return next;
}

function listRoomHistory() {
  return readHistory();
}

function clearRoomHistory() {
  writeHistory([]);
}

export {
  touchRoomHistory,
  listRoomHistory,
  clearRoomHistory,
};

const STORAGE_KEYS = {
  room: 'syncboard-room',
  user: 'syncboard-user',
  app: 'syncboard-app',
  session: 'syncboard-session',
};

const state = {
  currentUser: '',
  currentRoomId: 'lobby',
  currentDeviceType: 'desktop',
  currentTool: 'brush',
  currentColor: '#f59e0b',
  currentSize: 4,
  toolbarVisible: true,
  sidebarOpen: false,
  activePanel: 'chat',
  theme: 'dark',
  currentApp: 'whiteboard',
  boardOperations: [],
  messages: [],
  files: [],
  clipboardItems: [],
  users: [],
  unreadMessages: 0,
  connectionStatus: 'connecting',
  uploadState: {
    active: false,
    progress: 0,
    fileName: '',
  },
  downloads: new Map(),
  activityItems: [],
  typingUsers: new Set(),
  undoStack: [],
  redoStack: [],
  networkInfo: null,
  isDrawing: false,
  currentX: 0,
  currentY: 0,
};

function createInitialUsername() {
  return `用户${Math.floor(Math.random() * 900 + 100)}`;
}

function getStoredValue(storageKey) {
  try {
    return localStorage.getItem(storageKey) || '';
  } catch (_error) {
    return '';
  }
}

function getRoomFromLocation() {
  const url = new URL(window.location.href);
  return url.searchParams.get('room') || getStoredValue(STORAGE_KEYS.room) || 'lobby';
}

function detectDeviceType() {
  const normalized = navigator.userAgent.toLowerCase();

  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(normalized)) {
    return 'tablet';
  }

  if (/mobi|iphone|ipod|android|windows phone/i.test(normalized)) {
    return 'mobile';
  }

  return 'desktop';
}

function getStoredApp() {
  const stored = getStoredValue(STORAGE_KEYS.app);
  return ['whiteboard', 'monopoly', 'plane'].includes(stored) ? stored : 'whiteboard';
}

function getStoredSessionId() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEYS.session) || '';

    if (stored) {
      return stored;
    }
  } catch (_error) {
  }

  const created = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    sessionStorage.setItem(STORAGE_KEYS.session, created);
  } catch (_error) {
  }

  return created;
}

state.currentUser = getStoredValue(STORAGE_KEYS.user) || createInitialUsername();
state.currentRoomId = getRoomFromLocation();
state.currentDeviceType = detectDeviceType();
state.currentApp = getStoredApp();
state.sessionId = getStoredSessionId();

export { STORAGE_KEYS, state, getRoomFromLocation };

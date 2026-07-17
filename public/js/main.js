import { STORAGE_KEYS, state } from './modules/state.js';
import { getSocket } from './modules/socket.js';
import { createThemeModule } from './modules/theme.js';
import { createLayoutModule } from './modules/layout.js';
import { createWhiteboardModule } from './modules/whiteboard.js';
import { createChatModule } from './modules/chat.js';
import { createFilesModule } from './modules/files.js';
import { createPresenceModule } from './modules/presence.js';
import { createClipboardModule } from './modules/clipboard.js';
import { escapeHtml, formatTime } from './modules/utils.js';
import { t, cycleLang, getLang, getLangLabel, getLangCycleLabel } from './modules/i18n.js';
import { touchRoomHistory, listRoomHistory } from './modules/room-history.js';

const socket = getSocket();
const MONOPOLY_PORT = 3001;
const PLANE_PORT = 3002;
const MONOPOLY_STARTUP_DELAY_MS = 3500;
const MONOPOLY_IFRAME_READY_TIMEOUT_MS = 15000;
const PLANE_IFRAME_READY_TIMEOUT_MS = 35000;
let appSwitchRequestId = 0;
let monopolyIframeReady = false;
let planeIframeReady = false;

const elements = {
  root: document.documentElement,
  usernameInput: document.getElementById('usernameInput'),
  roomInput: document.getElementById('roomInput'),
  joinRoomPopoverButton: document.getElementById('joinRoomPopoverButton'),
  joinRoomModal: document.getElementById('joinRoomModal'),
  joinRoomBackdrop: document.getElementById('joinRoomBackdrop'),
  closeJoinRoomModalButton: document.getElementById('closeJoinRoomModalButton'),
  joinRoomButton: document.getElementById('joinRoomButton'),
  mobileMenuButton: document.getElementById('mobileMenuButton'),
  closeSidebarButton: document.getElementById('closeSidebarButton'),
  desktopSidebarToggleButton: document.getElementById('desktopSidebarToggleButton'),
  desktopSidebarCloseButton: document.getElementById('desktopSidebarCloseButton'),
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebarBackdrop'),
  boardStage: document.getElementById('boardStage'),
  fabButton: document.getElementById('fabButton'),
  toolbarPanel: document.getElementById('toolbarPanel'),
  toolbarDrawer: document.getElementById('toolbarDrawer'),
  chatTabButton: document.getElementById('chatTabButton'),
  filesTabButton: document.getElementById('filesTabButton'),
  clipboardTabButton: document.getElementById('clipboardTabButton'),
  chatPanel: document.getElementById('chatPanel'),
  filesPanel: document.getElementById('filesPanel'),
  clipboardPanel: document.getElementById('clipboardPanel'),
  unreadBadge: document.getElementById('unreadBadge'),
  appMenuButton: document.getElementById('appMenuButton'),
  appMenuPanel: document.getElementById('appMenuPanel'),
  appMenuCurrentText: document.getElementById('appMenuCurrentText'),
  appMenuItems: Array.from(document.querySelectorAll('.app-menu-item')),
  themeToggleButton: document.getElementById('themeToggleButton'),
  canvas: document.getElementById('board'),
  whiteboardStage: document.getElementById('whiteboardStage'),
  gameStage: document.getElementById('gameStage'),
  monopolyLoading: document.getElementById('monopolyLoading'),
  saveBoardButton: document.getElementById('saveBoardButton'),
  saveBoardButtonMirror: document.getElementById('saveBoardButtonMirror'),
  brushButton: document.getElementById('brushButton'),
  eraserButton: document.getElementById('eraserButton'),
  rectButton: document.getElementById('rectButton'),
  ellipseButton: document.getElementById('ellipseButton'),
  arrowButton: document.getElementById('arrowButton'),
  textButton: document.getElementById('textButton'),
  selectButton: document.getElementById('selectButton'),
  annotateButton: document.getElementById('annotateButton'),
  annotateInput: document.getElementById('annotateInput'),
  clearButton: document.getElementById('clearButton'),
  undoButton: document.getElementById('undoButton'),
  redoButton: document.getElementById('redoButton'),
  colorPicker: document.getElementById('colorPicker'),
  colorSwatches: Array.from(document.querySelectorAll('[data-color-swatch]')),
  brushSize: document.getElementById('brushSize'),
  brushSizeValue: document.getElementById('brushSizeValue'),
  brushButtonMirror: document.getElementById('brushButtonMirror'),
  eraserButtonMirror: document.getElementById('eraserButtonMirror'),
  rectButtonMirror: document.getElementById('rectButtonMirror'),
  ellipseButtonMirror: document.getElementById('ellipseButtonMirror'),
  arrowButtonMirror: document.getElementById('arrowButtonMirror'),
  textButtonMirror: document.getElementById('textButtonMirror'),
  selectButtonMirror: document.getElementById('selectButtonMirror'),
  annotateButtonMirror: document.getElementById('annotateButtonMirror'),
  clearButtonMirror: document.getElementById('clearButtonMirror'),
  undoButtonMirror: document.getElementById('undoButtonMirror'),
  redoButtonMirror: document.getElementById('redoButtonMirror'),
  colorPickerMirror: document.getElementById('colorPickerMirror'),
  brushSizeMirror: document.getElementById('brushSizeMirror'),
  privateSelect: document.getElementById('privateSelect'),
  mentionPopup: document.getElementById('mentionPopup'),
  mentionHint: document.getElementById('mentionHint'),
  roomHistoryList: document.getElementById('roomHistoryList'),
  joinRoomHistoryList: document.getElementById('joinRoomHistoryList'),
  auditReportPanel: document.getElementById('auditReportPanel'),
  auditReportButton: document.getElementById('auditReportButton'),
  auditReportModal: document.getElementById('auditReportModal'),
  auditReportBackdrop: document.getElementById('auditReportBackdrop'),
  closeAuditReportModalButton: document.getElementById('closeAuditReportModalButton'),
  refreshAuditReportButton: document.getElementById('refreshAuditReportButton'),
  auditReportRoomText: document.getElementById('auditReportRoomText'),
  langToggleButton: document.getElementById('langToggleButton'),
  connectionBanner: document.getElementById('connectionBanner'),
  currentUserText: document.getElementById('currentUserText'),
  currentRoomText: document.getElementById('currentRoomText'),
  onlineCountText: document.getElementById('onlineCountText'),
  onlineUsersText: document.getElementById('onlineUsersText'),
  currentAppText: document.getElementById('currentAppText'),
  connectionBadge: document.getElementById('connectionBadge'),
  roomBadge: document.getElementById('roomBadge'),
  networkBadge: document.getElementById('networkBadge'),
  shareToggleButton: document.getElementById('shareToggleButton'),
  sharePanel: document.getElementById('sharePanel'),
  shareLinkButton: document.getElementById('shareLinkButton'),
  qrCodeImage: document.getElementById('qrCodeImage'),
  boardAddressText: document.getElementById('boardAddressText'),
  toasts: document.getElementById('toasts'),
  activityList: document.getElementById('activityList'),
  chatList: document.getElementById('chatList'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  clearChatButton: document.getElementById('clearChatButton'),
  emojiToggleButton: document.getElementById('emojiToggleButton'),
  emojiBar: document.getElementById('emojiBar'),
  jumpToLatestButton: document.getElementById('jumpToLatestButton'),
  typingStatusText: document.getElementById('typingStatusText'),
  chatLengthText: document.getElementById('chatLengthText'),
  uploadForm: document.getElementById('uploadForm'),
  uploadInput: document.getElementById('uploadInput'),
  uploadDropzone: document.getElementById('uploadDropzone'),
  fileList: document.getElementById('fileList'),
  uploadProgress: document.getElementById('uploadProgress'),
  uploadProgressBar: document.getElementById('uploadProgressBar'),
  uploadProgressText: document.getElementById('uploadProgressText'),
  clipboardInput: document.getElementById('clipboardInput'),
  sendClipboardButton: document.getElementById('sendClipboardButton'),
  clipboardList: document.getElementById('clipboardList'),
  clipboardToasts: document.getElementById('clipboardToasts'),
};

state.currentUser = elements.usernameInput.value = state.currentUser;
state.currentRoomId = elements.roomInput.value = state.currentRoomId;

const presence = createPresenceModule({
  currentUserText: elements.currentUserText,
  currentRoomText: elements.currentRoomText,
  onlineCountText: elements.onlineCountText,
  onlineUsersText: elements.onlineUsersText,
  connectionBadge: elements.connectionBadge,
  roomBadge: elements.roomBadge,
  networkBadge: elements.networkBadge,
  shareLinkButton: elements.shareLinkButton,
  qrCodeImage: elements.qrCodeImage,
  boardAddressText: elements.boardAddressText,
  toasts: elements.toasts,
});

const layout = createLayoutModule({
  sidebar: elements.sidebar,
  boardStage: elements.boardStage,
  sidebarBackdrop: elements.sidebarBackdrop,
  mobileMenuButton: elements.mobileMenuButton,
  closeSidebarButton: elements.closeSidebarButton,
  desktopSidebarToggleButton: elements.desktopSidebarToggleButton,
  desktopSidebarCloseButton: elements.desktopSidebarCloseButton,
  fabButton: elements.fabButton,
  toolbarPanel: elements.toolbarPanel,
  toolbarDrawer: elements.toolbarDrawer,
  chatTabButton: elements.chatTabButton,
  filesTabButton: elements.filesTabButton,
  clipboardTabButton: elements.clipboardTabButton,
  chatPanel: elements.chatPanel,
  filesPanel: elements.filesPanel,
  clipboardPanel: elements.clipboardPanel,
  unreadBadge: elements.unreadBadge,
});

function renderActivityItems() {
  elements.activityList.innerHTML = state.activityItems.length
    ? state.activityItems.map((item) => `<article class="activity-item shrink-0"><p class="text-slate-600 dark:text-slate-300">${escapeHtml(item.text)}</p><p class="mt-1 text-[11px] text-slate-400">${formatTime(item.createdAt)}</p></article>`).join('')
    : '<p class="text-xs text-slate-400 dark:text-slate-500">等待新的协作动态...</p>';
}

function addActivity(text) {
  state.activityItems.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    createdAt: new Date().toISOString(),
  });
  state.activityItems = state.activityItems.slice(0, 12);
  renderActivityItems();
}

async function uploadCanvasImage(file) {
  const formData = new FormData();
  formData.append('roomId', state.currentRoomId);
  formData.append('image', file);

  const response = await fetch(`/api/images/upload?room=${encodeURIComponent(state.currentRoomId)}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('上传失败');
  }

  return response.json();
}

const whiteboard = createWhiteboardModule({
  canvas: elements.canvas,
  brushButtons: [elements.brushButton, elements.brushButtonMirror].filter(Boolean),
  eraserButtons: [elements.eraserButton, elements.eraserButtonMirror].filter(Boolean),
  clearButtons: [elements.clearButton, elements.clearButtonMirror].filter(Boolean),
  undoButtons: [elements.undoButton, elements.undoButtonMirror].filter(Boolean),
  redoButtons: [elements.redoButton, elements.redoButtonMirror].filter(Boolean),
  colorPickers: [elements.colorPicker, elements.colorPickerMirror].filter(Boolean),
  colorSwatches: elements.colorSwatches,
  brushSizeInputs: [elements.brushSize, elements.brushSizeMirror].filter(Boolean),
  brushSizeValue: elements.brushSizeValue,
  shapeRectButtons: [elements.rectButton, elements.rectButtonMirror].filter(Boolean),
  shapeEllipseButtons: [elements.ellipseButton, elements.ellipseButtonMirror].filter(Boolean),
  shapeArrowButtons: [elements.arrowButton, elements.arrowButtonMirror].filter(Boolean),
  textButtons: [elements.textButton, elements.textButtonMirror].filter(Boolean),
  selectButtons: [elements.selectButton, elements.selectButtonMirror].filter(Boolean),
  annotateButtons: [elements.annotateButton, elements.annotateButtonMirror].filter(Boolean),
  annotateInput: elements.annotateInput,
  onAddOperation: (operation) => {
    socket.emit('board-op:add', operation);
  },
  onRemoveOperation: (operationId) => {
    socket.emit('board-op:remove', { operationId });
  },
  onClear: () => {
    socket.emit('clear');
    addActivity(`${state.currentUser} 清空了白板`);
    presence.pushToast('白板已清空', `房间 ${state.currentRoomId} 的白板已同步清空`);
  },
  onUploadImage: uploadCanvasImage,
  onError: (title, description) => {
    presence.pushToast(title, description);
  },
});

const chat = createChatModule({
  chatList: elements.chatList,
  chatForm: elements.chatForm,
  chatInput: elements.chatInput,
  clearChatButton: elements.clearChatButton,
  emojiToggleButton: elements.emojiToggleButton,
  emojiBar: elements.emojiBar,
  typingStatusText: elements.typingStatusText,
  chatLengthText: elements.chatLengthText,
  jumpToLatestButton: elements.jumpToLatestButton,
  privateSelect: elements.privateSelect,
  mentionPopup: elements.mentionPopup,
  mentionHint: elements.mentionHint,
  onSendMessage: (text, toSocketId = '') => socket.emit('chat-message', { text, toSocketId }),
  onClearMessages: () => socket.emit('clear-messages'),
  onUnreadMessage: (message) => {
    // Own messages and system notices should not bump the unread badge.
    if (!message || message.kind === 'system') {
      return;
    }

    if (message.username === state.currentUser) {
      return;
    }

    layout.incrementUnread();
  },
  onTypingStart: () => socket.emit('typing', { isTyping: true }),
  onTypingStop: () => socket.emit('typing', { isTyping: false }),
});

const files = createFilesModule({
  uploadForm: elements.uploadForm,
  uploadInput: elements.uploadInput,
  uploadDropzone: elements.uploadDropzone,
  fileList: elements.fileList,
  uploadProgress: elements.uploadProgress,
  uploadProgressBar: elements.uploadProgressBar,
  uploadProgressText: elements.uploadProgressText,
  onUploadFile: uploadFile,
  onDownloadFile: downloadFile,
});

const clipboard = createClipboardModule({
  clipboardInput: elements.clipboardInput,
  sendClipboardButton: elements.sendClipboardButton,
  clipboardList: elements.clipboardList,
  clipboardToasts: elements.clipboardToasts,
  onSendClipboard: (text) => socket.emit('clipboard:send', { text }),
});

const theme = createThemeModule({
  root: elements.root,
  themeToggleButton: elements.themeToggleButton,
});

function persistSession() {
  try {
    localStorage.setItem(STORAGE_KEYS.user, state.currentUser);
    localStorage.setItem(STORAGE_KEYS.room, state.currentRoomId);
    localStorage.setItem(STORAGE_KEYS.app, state.currentApp);
  } catch (_error) {
    // Ignore storage failures in private mode or restricted environments.
  }
}

function setJoinRoomModalOpen(nextValue) {
  const open = Boolean(nextValue);
  elements.joinRoomModal.classList.toggle('hidden', !open);
  elements.joinRoomPopoverButton.setAttribute('aria-expanded', open ? 'true' : 'false');

  if (open) {
    window.requestAnimationFrame(() => {
      elements.usernameInput.focus();
      elements.usernameInput.select();
    });
  }
}

function setSharePanelOpen(nextValue) {
  const open = Boolean(nextValue);
  elements.sharePanel.classList.toggle('hidden', !open);
  elements.shareToggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  elements.shareToggleButton.textContent = open ? '收起分享 ▴' : '分享房间 ▾';
}

function bindSharePanelDismiss() {
  document.addEventListener('click', (event) => {
    if (elements.sharePanel.classList.contains('hidden')) {
      return;
    }

    const target = event.target;

    if (elements.shareToggleButton.contains(target) || elements.sharePanel.contains(target)) {
      return;
    }

    setSharePanelOpen(false);
  });
}

function syncRoomInputs() {
  elements.usernameInput.value = state.currentUser;
  elements.roomInput.value = state.currentRoomId;
}

async function loadNetworkInfo() {
  const roomParam = encodeURIComponent(state.currentRoomId);
  const response = await fetch(`/api/network-info?room=${roomParam}`);

  if (!response.ok) {
    throw new Error(`network-info failed: ${response.status}`);
  }

  const networkInfo = await response.json();
  presence.updateNetworkInfo(networkInfo);
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (key) {
      node.textContent = t(key);
    }
  });
  if (elements.langToggleButton) {
    // Show current language prominently, full cycle in title.
    elements.langToggleButton.textContent = getLangLabel();
    elements.langToggleButton.title = `${t('language')}: ${getLangCycleLabel()}`;
    elements.langToggleButton.setAttribute('aria-label', elements.langToggleButton.title);
  }
  // App menu labels
  elements.appMenuItems.forEach((item) => {
    const app = item.dataset.app;
    if (app === 'whiteboard') item.textContent = t('whiteboard');
    if (app === 'monopoly') item.textContent = t('monopoly');
    if (app === 'plane') item.textContent = t('plane');
  });
  if (elements.appMenuCurrentText) {
    elements.appMenuCurrentText.textContent = getAppDisplayName(state.currentApp);
  }
  document.title = t('appTitle');
}

function renderRoomHistoryLists() {
  const history = listRoomHistory();
  const render = (container) => {
    if (!container) {
      return;
    }
    container.innerHTML = history.length
      ? history.map((item) => (
        `<button type="button" class="block w-full rounded-[8px] px-2 py-1.5 text-left hover:bg-[var(--bg-muted)]" data-history-room="${escapeHtml(item.roomId)}">`
        + `<span class="font-semibold text-[var(--fg)]">${escapeHtml(item.roomId)}</span>`
        + `<span class="ml-2 text-2xs text-[var(--fg-muted)]">${formatTime(item.lastVisitedAt)}</span></button>`
      )).join('')
      : '<p class="px-1 text-[var(--fg-muted)]">暂无历史房间</p>';

    container.querySelectorAll('[data-history-room]').forEach((button) => {
      button.addEventListener('click', () => {
        elements.roomInput.value = button.getAttribute('data-history-room') || 'lobby';
        if (container === elements.joinRoomHistoryList) {
          setJoinRoomModalOpen(true);
        } else {
          joinCurrentRoom();
        }
      });
    });
  };

  render(elements.roomHistoryList);
  render(elements.joinRoomHistoryList);
}

function setAuditReportModalOpen(nextValue) {
  if (!elements.auditReportModal) {
    return;
  }
  elements.auditReportModal.classList.toggle('hidden', !nextValue);
}

function renderAuditReport(audit) {
  if (!elements.auditReportPanel) {
    return;
  }
  if (elements.auditReportRoomText) {
    elements.auditReportRoomText.textContent = `${t('currentRoom')}: ${state.currentRoomId}`;
  }
  if (!audit?.stats) {
    elements.auditReportPanel.innerHTML = '<p class="col-span-2 text-xs text-slate-400">暂无简报</p>';
    return;
  }
  const stats = audit.stats;
  const items = [
    ['笔画', stats.strokes || 0],
    ['形状', stats.shapes || 0],
    ['文字', stats.texts || 0],
    ['图片', stats.images || 0],
    ['消息', stats.messages || 0],
    ['私聊', stats.privateMessages || 0],
    ['文件', stats.files || 0],
    ['清空', stats.clears || 0],
    ['进房', stats.joins || 0],
    ['在线', audit.onlineCount || 0],
  ];
  elements.auditReportPanel.innerHTML = items.map(([label, value]) => (
    `<div class="sb-surface-muted px-3 py-2.5">`
    + `<p class="text-2xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">${escapeHtml(label)}</p>`
    + `<p class="mt-1 text-base font-bold tracking-tight text-[var(--fg)]">${escapeHtml(String(value))}</p>`
    + `</div>`
  )).join('');
}

async function refreshAuditReport() {
  try {
    const response = await fetch(`/api/rooms/${encodeURIComponent(state.currentRoomId)}/audit`);
    if (!response.ok) {
      renderAuditReport(null);
      return;
    }
    const audit = await response.json();
    renderAuditReport(audit);
  } catch (_error) {
    renderAuditReport(null);
  }
}

async function openAuditReportModal() {
  setAuditReportModalOpen(true);
  if (elements.auditReportPanel) {
    elements.auditReportPanel.innerHTML = '<p class="col-span-2 text-xs text-slate-400">加载中…</p>';
  }
  await refreshAuditReport();
}

function setConnectionBanner(visible) {
  if (!elements.connectionBanner) {
    return;
  }
  elements.connectionBanner.classList.toggle('hidden', !visible);
}

function joinCurrentRoom() {
  state.currentUser = elements.usernameInput.value.trim() || state.currentUser;
  state.currentRoomId = elements.roomInput.value.trim() || state.currentRoomId;
  persistSession();
  touchRoomHistory(state.currentRoomId, state.currentUser);
  renderRoomHistoryLists();
  const url = new URL(window.location.href);
  url.searchParams.set('room', state.currentRoomId);
  window.history.replaceState({}, '', url);
  syncRoomInputs();
  syncActiveGameIframeSession();
  setJoinRoomModalOpen(false);
  chat.setTypingUsers([]);
  socket.emit('join-room', {
    username: state.currentUser,
    roomId: state.currentRoomId,
    deviceType: state.currentDeviceType,
    sessionId: state.sessionId,
  });
  loadNetworkInfo().catch(() => {
    presence.pushToast('网络信息获取失败', '已回退使用当前页面地址');
  });
}

function uploadFile(file) {
  const formData = new FormData();
  formData.append('roomId', state.currentRoomId);
  formData.append('username', state.currentUser);
  formData.append('file', file);

  const request = new XMLHttpRequest();
  const uploadUrl = `/api/files/upload?room=${encodeURIComponent(state.currentRoomId)}`;
  request.open('POST', uploadUrl);

  files.updateUploadProgress({
    active: true,
    progress: 0,
    fileName: file.name,
  });

  request.upload.addEventListener('progress', (event) => {
    if (!event.lengthComputable) {
      return;
    }

    files.updateUploadProgress({
      active: true,
      progress: Math.round((event.loaded / event.total) * 100),
      fileName: file.name,
    });
  });

  request.addEventListener('load', () => {
    files.updateUploadProgress({ active: false });
    if (request.status >= 200 && request.status < 300) {
      presence.pushToast('文件上传完成', file.name);
      layout.setActivePanel('files');
      if (window.innerWidth < 1024) {
        layout.setSidebarOpen(true);
      }
    } else {
      let message = '上传失败';

      try {
        message = JSON.parse(request.responseText || '{}').message || message;
      } catch (_error) {
        // Non-JSON error bodies should still surface a readable toast.
      }

      presence.pushToast('文件上传失败', message);
    }
  });

  request.addEventListener('error', () => {
    files.updateUploadProgress({ active: false });
    presence.pushToast('文件上传失败', '请检查网络后重试');
  });

  request.send(formData);
}

async function downloadFile(file) {
  try {
    files.updateDownloadProgress(file.storedName, 100, {
      indeterminate: true,
      label: '正在下载…',
    });
    const response = await fetch(file.downloadUrl);

    if (!response.ok || !response.body) {
      files.updateDownloadProgress(file.storedName, 100);
      presence.pushToast('下载失败', '无法读取该文件');
      return;
    }

    const total = Number(response.headers.get('content-length')) || 0;
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);
      loaded += value.length;

      if (total > 0) {
        files.updateDownloadProgress(file.storedName, Math.round((loaded / total) * 100));
      }
    }

    files.updateDownloadProgress(file.storedName, 100);

    const blob = new Blob(chunks, { type: file.mimeType });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
    presence.pushToast('下载完成', file.name);
  } catch (_error) {
    files.updateDownloadProgress(file.storedName, 100);
    presence.pushToast('下载失败', '请稍后重试');
  }
}


function closeAppMenu() {
  if (!elements.appMenuPanel || !elements.appMenuButton) {
    return;
  }

  elements.appMenuPanel.classList.add('hidden');
  elements.appMenuPanel.setAttribute('aria-hidden', 'true');
  elements.appMenuButton.setAttribute('aria-expanded', 'false');
}

function setAppMenuOpen(nextValue) {
  if (!elements.appMenuPanel || !elements.appMenuButton) {
    return;
  }

  const open = Boolean(nextValue);
  elements.appMenuPanel.classList.toggle('hidden', !open);
  elements.appMenuPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  elements.appMenuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function getAppDisplayName(app) {
  if (app === 'monopoly') {
    return t('monopoly');
  }

  if (app === 'plane') {
    return t('plane');
  }

  return t('whiteboard');
}

function syncAppMenuSelection(app) {
  const currentLabel = getAppDisplayName(app);

  if (elements.appMenuCurrentText) {
    elements.appMenuCurrentText.textContent = currentLabel;
  }

  elements.appMenuItems.forEach((item) => {
    const active = item.dataset.app === app;
    item.classList.toggle('bg-slate-50', active);
    item.classList.toggle('text-slate-900', active);
    item.classList.toggle('font-medium', active);
    item.classList.toggle('dark:bg-slate-700/70', active);
    item.classList.toggle('dark:text-slate-100', active);
    item.setAttribute('aria-current', active ? 'true' : 'false');
  });
}

function saveWhiteboard() {
  whiteboard.exportAsPng();
  presence.pushToast('保存成功', '当前白板内容已保存为 PNG');
}

function setMonopolyLoadingState(message) {
  if (!elements.monopolyLoading) {
    return;
  }

  const textElement = elements.monopolyLoading.querySelector('[data-monopoly-loading-text]');
  if (textElement && typeof message === 'string') {
    textElement.textContent = message;
  }
}

function setMonopolyLoadingVisible(visible) {
  if (!elements.monopolyLoading) {
    return;
  }

  elements.monopolyLoading.classList.toggle('hidden', !visible);
}

function showWhiteboardStage() {
  elements.whiteboardStage?.classList.remove('hidden');
  elements.gameStage?.classList.add('hidden');
}

function showGameStage() {
  elements.whiteboardStage?.classList.add('hidden');
  elements.gameStage?.classList.remove('hidden');
}

function updateCurrentAppText(app) {
  if (elements.currentAppText) {
    elements.currentAppText.textContent = getAppDisplayName(app);
  }
}

function buildMonopolyUrl() {
  const protocol = window.location.protocol || 'http:';
  const host = window.location.hostname || 'localhost';
  const roomId = String(state.currentRoomId || '').trim() || 'lobby';
  const username = String(state.currentUser || '').trim() || '用户';
  const monopolyUrl = new URL(`${protocol}//${host}:${MONOPOLY_PORT}/Monopoly/`);
  monopolyUrl.searchParams.set('username', username);
  monopolyUrl.searchParams.set('room', roomId);
  monopolyUrl.searchParams.set('source', 'syncboard');
  return monopolyUrl.toString();
}

function buildPlaneUrl() {
  const protocol = window.location.protocol || 'http:';
  const host = window.location.hostname || 'localhost';
  const roomId = String(state.currentRoomId || '').trim() || 'lobby';
  const username = String(state.currentUser || '').trim() || '用户';
  // gameId/room bind this plane match to the current SyncBoard room name.
  const planeUrl = new URL(`${protocol}//${host}:${PLANE_PORT}/`);
  planeUrl.searchParams.set('gameId', roomId);
  planeUrl.searchParams.set('room', roomId);
  planeUrl.searchParams.set('username', username);
  planeUrl.searchParams.set('source', 'syncboard');
  return planeUrl.toString();
}

function getGameIframeTimeout(app) {
  return app === 'plane' ? PLANE_IFRAME_READY_TIMEOUT_MS : MONOPOLY_IFRAME_READY_TIMEOUT_MS;
}

function syncActiveGameIframeSession() {
  if (!elements.gameStage) {
    return;
  }

  if (state.currentApp !== 'monopoly' && state.currentApp !== 'plane') {
    return;
  }

  const gameUrl = state.currentApp === 'monopoly' ? buildMonopolyUrl() : buildPlaneUrl();
  const currentSrc = elements.gameStage.getAttribute('src') || '';

  if (currentSrc === gameUrl) {
    return;
  }

  // Room/user changed while a game is open — reload iframe with the new room binding.
  if (state.currentApp === 'monopoly') {
    monopolyIframeReady = false;
  } else {
    planeIframeReady = false;
  }

  const requestId = ++appSwitchRequestId;
  setMonopolyLoadingVisible(true);
  setMonopolyLoadingState(`正在切换到房间「${state.currentRoomId}」...`);
  showWhiteboardStage();

  loadGameIframe(gameUrl, requestId, state.currentApp)
    .then(() => {
      if (requestId !== appSwitchRequestId || (state.currentApp !== 'monopoly' && state.currentApp !== 'plane')) {
        return;
      }
      showGameStage();
      setMonopolyLoadingVisible(false);
    })
    .catch((error) => {
      if (requestId !== appSwitchRequestId) {
        return;
      }
      presence.pushToast('切换房间失败', error instanceof Error ? error.message : '请重试');
      setMonopolyLoadingVisible(false);
    });
}

async function probeGameUrlReachable(gameUrl) {
  try {
    // no-cors: we only care that the browser can open a TCP/HTTP connection.
    await fetch(gameUrl, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
    });
    return true;
  } catch (_error) {
    return false;
  }
}

function loadGameIframe(gameUrl, requestId, app) {
  return new Promise((resolve, reject) => {
    if (!elements.gameStage) {
      reject(new Error('未找到游戏容器'));
      return;
    }

    const iframe = elements.gameStage;
    const gameName = app === 'monopoly' ? '大富翁' : '飞行棋';
    const timeoutMs = getGameIframeTimeout(app);
    let settled = false;

    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutHandle);
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);

      if (error) {
        reject(error);
        return;
      }

      if (app === 'monopoly') {
        monopolyIframeReady = true;
      } else {
        planeIframeReady = true;
      }
      resolve();
    };

    const timeoutHandle = window.setTimeout(() => {
      const port = app === 'monopoly' ? MONOPOLY_PORT : PLANE_PORT;
      finish(new Error(
        `${gameName}页面加载超时（${Math.round(timeoutMs / 1000)}s）。`
        + `请确认本机可访问 ${window.location.hostname}:${port}，`
        + '并在 Windows 防火墙中允许 Node/Java 的专用网络访问。',
      ));
    }, timeoutMs);

    function handleLoad() {
      if (requestId !== appSwitchRequestId || state.currentApp !== app) {
        finish();
        return;
      }

      // Ignore the intermediate about:blank navigation.
      const src = iframe.getAttribute('src') || '';
      if (!src || src === 'about:blank') {
        return;
      }

      finish();
    }

    function handleError() {
      if (requestId !== appSwitchRequestId || state.currentApp !== app) {
        finish();
        return;
      }
      finish(new Error(`${gameName}页面加载失败，请检查游戏服务是否已启动`));
    }

    // Attach listeners BEFORE changing src to avoid missing a fast load event.
    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    // Force a fresh navigation even when the URL is unchanged (retry / re-enter).
    iframe.setAttribute('src', 'about:blank');
    window.setTimeout(() => {
      if (requestId !== appSwitchRequestId || state.currentApp !== app) {
        finish();
        return;
      }
      iframe.setAttribute('src', gameUrl);
    }, 30);
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function startMonopolyEngine() {
  const response = await fetch('/api/start-game/monopoly');
  let payload = null;

  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok || payload?.ok === false) {
    const message = payload?.message || '请检查后端日志';
    throw new Error(message);
  }

  return payload;
}

async function startPlaneEngine() {
  const response = await fetch('/api/start-game/plane');
  let payload = null;

  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok || payload?.ok === false) {
    const message = payload?.message || '请检查后端日志';
    throw new Error(message);
  }

  return payload;
}

async function setActiveApp(nextApp) {
  const app = ['monopoly', 'plane'].includes(nextApp) ? nextApp : 'whiteboard';
  const requestId = ++appSwitchRequestId;
  state.currentApp = app;
  persistSession();

  syncAppMenuSelection(app);
  updateCurrentAppText(app);

  if (app === 'whiteboard') {
    setMonopolyLoadingVisible(false);
    showWhiteboardStage();
    window.requestAnimationFrame(() => {
      whiteboard.resizeCanvas();
    });
    return;
  }

  const gameIcon = app === 'monopoly' ? '🎲' : '✈️';
  const gameName = app === 'monopoly' ? '大富翁' : '飞行棋';

  setMonopolyLoadingVisible(true);
  setMonopolyLoadingState(`${gameIcon} 正在唤醒${gameName}引擎...`);
  showWhiteboardStage();

  try {
    const startupResult = app === 'monopoly' ? await startMonopolyEngine() : await startPlaneEngine();

    if (requestId !== appSwitchRequestId || state.currentApp !== app) {
      return;
    }

    if (startupResult?.status === 'already-running') {
      setMonopolyLoadingState(`${gameIcon} ${gameName}引擎已就绪，正在连接房间...`);
    } else {
      setMonopolyLoadingState(`${gameIcon} 引擎已启动，正在准备房间...`);
      // Monopoly Vite needs a short warm-up; plane jar is ready once /api says so.
      if (app === 'monopoly') {
        await delay(MONOPOLY_STARTUP_DELAY_MS);
      }
    }

    if (requestId !== appSwitchRequestId || state.currentApp !== app) {
      return;
    }

    const gameUrl = app === 'monopoly' ? buildMonopolyUrl() : buildPlaneUrl();

    if (!elements.gameStage) {
      throw new Error('未找到游戏容器');
    }

    if (app === 'plane') {
      setMonopolyLoadingState(`${gameIcon} 正在探测飞行棋服务（房间：${state.currentRoomId}）...`);
      const reachable = await probeGameUrlReachable(gameUrl);
      if (!reachable) {
        throw new Error(
          `浏览器无法访问飞行棋端口 ${PLANE_PORT}。`
          + '请允许 Java/Node 通过 Windows 防火墙的“专用网络”，或直接在浏览器打开 '
          + `http://${window.location.hostname}:${PLANE_PORT}/ 验证。`,
        );
      }
      setMonopolyLoadingState(`${gameIcon} 已连接房间「${state.currentRoomId}」，正在加载棋盘...`);
    } else {
      setMonopolyLoadingState(`${gameIcon} 正在加载${gameName}页面...`);
    }

    if (app === 'monopoly') {
      monopolyIframeReady = false;
    } else {
      planeIframeReady = false;
    }

    await loadGameIframe(gameUrl, requestId, app);

    if (requestId !== appSwitchRequestId || state.currentApp !== app) {
      return;
    }

    showGameStage();
    setMonopolyLoadingVisible(false);
  } catch (error) {
    if (requestId !== appSwitchRequestId || state.currentApp !== app) {
      return;
    }

    state.currentApp = 'whiteboard';
    persistSession();
    syncAppMenuSelection('whiteboard');
    updateCurrentAppText('whiteboard');
    showWhiteboardStage();
    setMonopolyLoadingVisible(false);

    window.requestAnimationFrame(() => {
      whiteboard.resizeCanvas();
    });

    presence.pushToast(`${gameName}启动失败`, error instanceof Error ? error.message : '请稍后重试');
  }
}

function bindSocketEvents() {
  socket.on('connect', () => {
    presence.updateConnection('connected');
    setConnectionBanner(false);
    if (state.connectionStatus === 'disconnected' || state.hadDisconnect) {
      presence.pushToast(t('reconnected'), state.currentRoomId);
    }
    state.hadDisconnect = false;
    addActivity('已连接协作服务');
    joinCurrentRoom();
  });

  socket.on('disconnect', () => {
    presence.updateConnection('disconnected');
    state.hadDisconnect = true;
    setConnectionBanner(true);
    chat.setTypingUsers([]);
    addActivity('连接已断开，正在等待重连');
    presence.pushToast(t('disconnected'), t('reconnectBanner'));
  });

  socket.on('room-state', ({ roomId, username, deviceType, operations, messages, files: roomFiles, users, clipboardItems, audit }) => {
    state.currentRoomId = roomId;
    state.currentUser = username;
    state.currentDeviceType = deviceType;
    state.activityItems = [];
    persistSession();
    touchRoomHistory(roomId, username);
    renderRoomHistoryLists();
    const url = new URL(window.location.href);
    url.searchParams.set('room', state.currentRoomId);
    window.history.replaceState({}, '', url);
    syncRoomInputs();
    syncActiveGameIframeSession();
    whiteboard.applyRoomOperations(operations);
    chat.setMessages(messages);
    chat.setTypingUsers([]);
    files.setFiles(roomFiles);
    clipboard.setItems(clipboardItems || []);
    presence.renderUsers(users);
    chat.updatePrivateTargets(users);
    if (audit) {
      renderAuditReport(audit);
    }

    if (state.currentApp === 'whiteboard') {
      whiteboard.resizeCanvas();
    }

    addActivity(`你已进入房间 ${roomId}`);
  });

  socket.on('users-updated', ({ users }) => {
    presence.renderUsers(users);
    chat.updatePrivateTargets(users);
  });

  socket.on('chat-mention', ({ from, text }) => {
    presence.pushToast(`@你 · ${from || '成员'}`, text || '');
    if (window.Notification && Notification.permission === 'granted') {
      try {
        new Notification(`@你 · ${from || '成员'}`, { body: text || '' });
      } catch (_error) {
      }
    }
  });

  socket.on('typing-users', ({ users }) => {
    chat.setTypingUsers(users);
  });

  socket.on('board-op:added', (operation) => {
    whiteboard.appendRemoteOperation(operation);

    if (operation.type === 'image') {
      addActivity(`${operation.username || '成员'} 插入了一张图片`);
    }
  });

  socket.on('board-op:removed', ({ operationId }) => {
    whiteboard.removeRemoteOperation(operationId);
  });

  socket.on('clear', () => {
    whiteboard.clearCanvas(false);
  });

  socket.on('chat-message', (message) => {
    chat.appendMessage(message);

    if (message.kind === 'system') {
      addActivity(message.text);
    }
  });

  socket.on('messages-cleared', () => {
    chat.clearMessagesLocally();
    addActivity('聊天记录已清空');
  });

  socket.on('file-added', (file) => {
    files.appendFile(file);
    addActivity(`${file.username || '成员'} 上传了文件 ${file.name}`);
    presence.pushToast('有新文件可下载', file.name);
  });

  socket.on('clipboard:received', (item) => {
    const isSelf = item.socketId === socket.id;
    clipboard.appendItem(item, { isSelf });
    addActivity(`${item.username || '成员'} 更新了云剪贴板`);
  });
}

function bindControls() {
  elements.joinRoomPopoverButton.addEventListener('click', () => {
    setJoinRoomModalOpen(true);
  });

  elements.closeJoinRoomModalButton.addEventListener('click', () => {
    setJoinRoomModalOpen(false);
  });

  elements.joinRoomBackdrop.addEventListener('click', () => {
    setJoinRoomModalOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setJoinRoomModalOpen(false);
      setAuditReportModalOpen(false);
      closeAppMenu();
    }
  });

  elements.joinRoomButton.addEventListener('click', joinCurrentRoom);
  elements.usernameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      joinCurrentRoom();
    }
  });

  elements.roomInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      joinCurrentRoom();
    }
  });

  elements.shareToggleButton.addEventListener('click', () => {
    const isClosed = elements.sharePanel.classList.contains('hidden');
    setSharePanelOpen(isClosed);
  });

  elements.saveBoardButton?.addEventListener('click', saveWhiteboard);
  elements.saveBoardButtonMirror?.addEventListener('click', saveWhiteboard);

  elements.appMenuButton?.addEventListener('click', () => {
    const closed = elements.appMenuPanel?.classList.contains('hidden') ?? true;
    setAppMenuOpen(closed);
  });

  elements.appMenuItems.forEach((item) => {
    item.addEventListener('click', () => {
      const nextApp = item.dataset.app || 'whiteboard';
      setActiveApp(nextApp);
      closeAppMenu();
    });
  });

  elements.langToggleButton?.addEventListener('click', () => {
    // Cycle: 简体 → 繁體 → English → 日本語
    cycleLang();
    applyI18n();
    chat.updatePrivateTargets(state.users);
    if (elements.mentionHint) {
      elements.mentionHint.textContent = t('mentionHint');
    }
    presence.pushToast(t('language'), getLangLabel());
  });

  elements.auditReportButton?.addEventListener('click', () => {
    openAuditReportModal();
  });

  elements.closeAuditReportModalButton?.addEventListener('click', () => {
    setAuditReportModalOpen(false);
  });

  elements.auditReportBackdrop?.addEventListener('click', () => {
    setAuditReportModalOpen(false);
  });

  elements.refreshAuditReportButton?.addEventListener('click', async () => {
    await refreshAuditReport();
  });

  document.addEventListener('click', (event) => {
    if (!elements.appMenuPanel || !elements.appMenuButton) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    if (elements.appMenuButton.contains(target) || elements.appMenuPanel.contains(target)) {
      return;
    }

    closeAppMenu();
  });
}

theme.init();
layout.init();
whiteboard.init();
chat.init();
files.init();
clipboard.init();
renderActivityItems();
renderRoomHistoryLists();
applyI18n();
if (window.Notification && Notification.permission === 'default') {
  Notification.requestPermission().catch(() => {});
}
presence.updateConnection('connecting');
presence.renderUsers([]);
setConnectionBanner(false);
setJoinRoomModalOpen(false);
setSharePanelOpen(false);
bindSharePanelDismiss();
bindControls();
bindSocketEvents();
setActiveApp(state.currentApp);
loadNetworkInfo().catch(() => {
  presence.pushToast('网络信息获取失败', '稍后会在连接成功后自动重试');
});

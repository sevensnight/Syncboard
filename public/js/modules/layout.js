import { state } from './state.js';

const DESKTOP_BREAKPOINT = 1024;

function createLayoutModule({
  sidebar,
  boardStage,
  sidebarBackdrop,
  mobileMenuButton,
  closeSidebarButton,
  desktopSidebarToggleButton,
  desktopSidebarCloseButton,
  fabButton,
  toolbarPanel,
  toolbarDrawer,
  chatTabButton,
  filesTabButton,
  clipboardTabButton,
  chatPanel,
  filesPanel,
  clipboardPanel,
  unreadBadge,
}) {
  let desktopSidebarOpen = false;
  let sidebarHeightSyncTimer = null;

  function isDesktopViewport() {
    return window.innerWidth >= DESKTOP_BREAKPOINT;
  }

  function isSidebarOpen() {
    return isDesktopViewport() ? desktopSidebarOpen : state.sidebarOpen;
  }

  function notifyLayoutChanged() {
    window.dispatchEvent(new Event('syncboard:layout-changed'));
  }

  function syncDesktopToggleButton() {
    if (!desktopSidebarToggleButton) {
      return;
    }

    const expanded = desktopSidebarOpen;
    desktopSidebarToggleButton.textContent = expanded ? '折叠侧栏' : '展开侧栏';
    desktopSidebarToggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    desktopSidebarToggleButton.setAttribute('aria-label', expanded ? '折叠协作侧栏' : '展开协作侧栏');
  }

  function syncDesktopCloseButton() {
    if (!desktopSidebarCloseButton) {
      return;
    }

    desktopSidebarCloseButton.setAttribute('aria-label', desktopSidebarOpen ? '折叠协作侧栏' : '展开协作侧栏');
    desktopSidebarCloseButton.textContent = desktopSidebarOpen ? '—' : '⟩';
  }

  function syncDesktopSidebarHeight() {
    if (!sidebar || !boardStage || !isDesktopViewport() || !desktopSidebarOpen) {
      sidebar.style.removeProperty('height');
      sidebar.style.removeProperty('max-height');
      return;
    }

    const stageRect = boardStage.getBoundingClientRect();
    const nextHeight = Math.max(1, Math.floor(stageRect.width));
    sidebar.style.height = `${nextHeight}px`;
    sidebar.style.maxHeight = `${nextHeight}px`;
  }

  function scheduleDesktopSidebarHeightSync() {
    if (sidebarHeightSyncTimer) {
      window.clearTimeout(sidebarHeightSyncTimer);
      sidebarHeightSyncTimer = null;
    }

    syncDesktopSidebarHeight();
    notifyLayoutChanged();

    window.requestAnimationFrame(() => {
      syncDesktopSidebarHeight();
      notifyLayoutChanged();
    });

    sidebarHeightSyncTimer = window.setTimeout(() => {
      sidebarHeightSyncTimer = null;
      syncDesktopSidebarHeight();
      notifyLayoutChanged();
    }, 340);
  }

  function applySidebarVisibility() {
    const desktop = isDesktopViewport();
    const open = isSidebarOpen();

    if (desktop) {
      sidebar.classList.add('translate-x-0');
      sidebar.classList.remove('translate-x-full');
      sidebar.classList.toggle('is-collapsed', !open);
      sidebarBackdrop.classList.add('hidden');
      syncDesktopToggleButton();
      syncDesktopCloseButton();
      scheduleDesktopSidebarHeightSync();
      return;
    }

    sidebar.style.removeProperty('height');
    sidebar.style.removeProperty('max-height');
    sidebar.classList.remove('is-collapsed');
    sidebar.classList.toggle('translate-x-0', open);
    sidebar.classList.toggle('translate-x-full', !open);
    sidebarBackdrop.classList.toggle('hidden', !open);
    syncDesktopToggleButton();
    syncDesktopCloseButton();
    notifyLayoutChanged();
  }

  function setSidebarOpen(nextValue) {
    const open = Boolean(nextValue);

    if (isDesktopViewport()) {
      desktopSidebarOpen = open;
    } else {
      state.sidebarOpen = open;
    }

    applySidebarVisibility();
  }

  function applyToolbarVisibility() {
    const desktop = isDesktopViewport();

    if (desktop) {
      toolbarPanel.classList.toggle('hidden', !state.toolbarVisible);
      toolbarDrawer.classList.add('hidden');
    } else {
      toolbarPanel.classList.add('hidden');
      toolbarDrawer.classList.toggle('hidden', !state.toolbarVisible);
    }

    const label = state.toolbarVisible ? '隐藏工具栏' : '显示工具栏';
    fabButton.textContent = label;
    fabButton.setAttribute('aria-label', label);
    fabButton.classList.toggle('is-collapsed', !state.toolbarVisible);
  }

  function setToolbarVisible(nextValue) {
    state.toolbarVisible = Boolean(nextValue);
    applyToolbarVisibility();
  }

  function setActivePanel(panelName) {
    state.activePanel = panelName;
    const isChat = panelName === 'chat';
    const isFiles = panelName === 'files';
    const isClipboard = panelName === 'clipboard';

    chatTabButton.classList.toggle('is-active', isChat);
    filesTabButton.classList.toggle('is-active', isFiles);
    clipboardTabButton.classList.toggle('is-active', isClipboard);

    chatPanel.classList.toggle('hidden', !isChat);
    filesPanel.classList.toggle('hidden', !isFiles);
    clipboardPanel.classList.toggle('hidden', !isClipboard);

    if (isChat) {
      state.unreadMessages = 0;
      unreadBadge.textContent = '0';
      unreadBadge.classList.add('hidden');
    }
  }

  function isChatPanelVisible() {
    return state.activePanel === 'chat' && (isDesktopViewport() ? desktopSidebarOpen : state.sidebarOpen);
  }

  function incrementUnread() {
    if (isChatPanelVisible()) {
      return;
    }

    state.unreadMessages += 1;
    unreadBadge.textContent = String(state.unreadMessages);
    unreadBadge.classList.toggle('hidden', state.unreadMessages === 0);
  }

  function syncResponsiveState() {
    if (isDesktopViewport()) {
      state.sidebarOpen = false;
    }

    applySidebarVisibility();
    applyToolbarVisibility();
  }

  function init() {
    mobileMenuButton.addEventListener('click', () => {
      setSidebarOpen(!isSidebarOpen());
    });
    closeSidebarButton.addEventListener('click', () => setSidebarOpen(false));
    sidebarBackdrop.addEventListener('click', () => setSidebarOpen(false));
    desktopSidebarToggleButton?.addEventListener('click', () => setSidebarOpen(!desktopSidebarOpen));
    desktopSidebarCloseButton?.addEventListener('click', () => setSidebarOpen(!desktopSidebarOpen));
    fabButton.addEventListener('click', () => setToolbarVisible(!state.toolbarVisible));
    chatTabButton.addEventListener('click', () => setActivePanel('chat'));
    filesTabButton.addEventListener('click', () => setActivePanel('files'));
    clipboardTabButton.addEventListener('click', () => setActivePanel('clipboard'));

    let resizeFrame = null;
    window.addEventListener('resize', () => {
      if (resizeFrame) {
        return;
      }

      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        syncResponsiveState();
      });
    });

    desktopSidebarOpen = false;
    state.sidebarOpen = false;
    applySidebarVisibility();
    setToolbarVisible(true);
    setActivePanel('chat');
  }

  return {
    incrementUnread,
    init,
    isChatPanelVisible,
    setActivePanel,
    setSidebarOpen,
    setToolbarVisible,
  };
}

export { createLayoutModule };


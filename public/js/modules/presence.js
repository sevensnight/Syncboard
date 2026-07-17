import { state } from './state.js';
import { createToastHtml } from './utils.js';
import { t } from './i18n.js';

function createPresenceModule({
  currentUserText,
  currentRoomText,
  onlineCountText,
  onlineUsersText,
  connectionBadge,
  roomBadge,
  networkBadge,
  shareLinkButton,
  qrCodeImage,
  boardAddressText,
  toasts,
}) {
  function renderUsers(users = []) {
    state.users = users;
    currentUserText.textContent = state.currentUser;
    currentRoomText.textContent = state.currentRoomId;
    onlineCountText.textContent = `${users.length}`;
    onlineUsersText.textContent = users.length ? users.map((user) => `${user.username} · ${user.deviceType}`).join(' / ') : '—';
    roomBadge.textContent = `${t('currentRoom')} ${state.currentRoomId}`;
  }

  function updateConnection(status) {
    state.connectionStatus = status;
    const mapping = {
      connecting: [t('connecting'), 'bg-amber-400'],
      connected: [t('connected'), 'bg-emerald-400'],
      disconnected: [t('disconnected'), 'bg-rose-400'],
    };
    const [label, dotClass] = mapping[status] || mapping.disconnected;
    connectionBadge.innerHTML = `<span class="h-2.5 w-2.5 rounded-full ${dotClass}"></span>${label}`;
  }

  async function copyShareLink(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.className = 'fixed left-[-9999px] top-0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  function updateNetworkInfo(networkInfo) {
    state.networkInfo = networkInfo;
    boardAddressText.textContent = networkInfo.shareUrl || networkInfo.preferredLanUrl || networkInfo.localhostUrl || window.location.origin;
    networkBadge.textContent = networkInfo.preferredLanUrl || networkInfo.localhostUrl || window.location.origin;
    qrCodeImage.src = networkInfo.qrCodeDataUrl;
    shareLinkButton.onclick = async () => {
      const shareText = boardAddressText.textContent;
      try {
        await copyShareLink(shareText);
        pushToast('分享链接已复制', shareText);
      } catch (_error) {
        pushToast('复制失败', '请手动复制当前链接');
      }
    };
  }

  function pushToast(title, description) {
    const toast = document.createElement('div');
    toast.innerHTML = createToastHtml({ title, description });
    const node = toast.firstElementChild;
    toasts.appendChild(node);
    window.setTimeout(() => {
      node.remove();
    }, 3000);
  }

  return {
    pushToast,
    renderUsers,
    updateConnection,
    updateNetworkInfo,
  };
}

export { createPresenceModule };

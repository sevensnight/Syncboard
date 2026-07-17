import { state } from './state.js';
import { escapeHtml, formatTime } from './utils.js';

async function copyText(value) {
  const text = String(value || '');

  if (!text) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.className = 'fixed left-[-9999px] top-0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

function createClipboardModule({
  clipboardInput,
  sendClipboardButton,
  clipboardList,
  clipboardToasts,
  onSendClipboard,
}) {
  function renderItem(item) {
    return (
      `<article class="clipboard-item">`
      + `<div class="clipboard-item-head">`
      + `<strong class="clipboard-item-name">${escapeHtml(item.username || '匿名用户')}</strong>`
      + `<span class="clipboard-item-time">${formatTime(item.createdAt)}</span>`
      + `</div>`
      + `<pre class="clipboard-content">${escapeHtml(item.text)}</pre>`
      + `<div class="clipboard-item-actions">`
      + `<button type="button" class="secondary-button clipboard-copy-btn" data-copy-id="${escapeHtml(item.id)}">一键复制</button>`
      + `</div>`
      + `</article>`
    );
  }

  function bindCopyButtons() {
    clipboardList.querySelectorAll('[data-copy-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        const itemId = button.getAttribute('data-copy-id');
        const item = state.clipboardItems.find((entry) => entry.id === itemId);

        if (!item) {
          return;
        }

        try {
          await copyText(item.text);
          button.textContent = '已复制';
        } catch (_error) {
          button.textContent = '复制失败';
        }
      });
    });
  }

  function renderItems() {
    clipboardList.innerHTML = state.clipboardItems.length
      ? [...state.clipboardItems].reverse().map(renderItem).join('')
      : '<div class="clipboard-empty">还没有云剪贴板内容，发送第一条文本吧。</div>';

    bindCopyButtons();
  }

  function showIncomingToast(item, autoCopied) {
    const wrapper = document.createElement('div');
    wrapper.className = 'clipboard-toast pointer-events-auto';
    wrapper.innerHTML = `<p class="clipboard-toast-title">收到 ${escapeHtml(item.username || '成员')} 的剪贴板</p><p class="clipboard-toast-description">${autoCopied ? '已尝试自动写入剪贴板，可点击再次复制确认。' : '点击下方按钮可一键复制到本机。'}</p><div class="mt-3 flex justify-end"><button type="button" class="primary-button px-3 py-2 text-xs">一键复制</button></div>`;

    const copyButton = wrapper.querySelector('button');
    copyButton.addEventListener('click', async () => {
      try {
        await copyText(item.text);
        copyButton.textContent = '复制成功';
      } catch (_error) {
        copyButton.textContent = '复制失败';
      }
    });

    clipboardToasts.appendChild(wrapper);
    window.setTimeout(() => {
      wrapper.remove();
    }, 5000);
  }

  async function tryAutoCopy(text) {
    if (!navigator.clipboard?.writeText) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function setItems(items) {
    state.clipboardItems = Array.isArray(items) ? [...items].slice(-100) : [];
    renderItems();
  }

  async function appendItem(item, { isSelf = false } = {}) {
    state.clipboardItems.push(item);
    state.clipboardItems = state.clipboardItems.slice(-100);
    renderItems();

    if (!isSelf) {
      const autoCopied = await tryAutoCopy(item.text);
      showIncomingToast(item, autoCopied);
    }
  }

  function sendCurrentInput() {
    const text = clipboardInput.value.trim();

    if (!text) {
      return;
    }

    onSendClipboard(text);
    clipboardInput.value = '';
  }

  function init() {
    sendClipboardButton.addEventListener('click', sendCurrentInput);
    clipboardInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        sendCurrentInput();
      }
    });
    renderItems();
  }

  return {
    appendItem,
    init,
    setItems,
  };
}

export { createClipboardModule };

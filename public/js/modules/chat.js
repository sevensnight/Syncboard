import { state } from './state.js';
import { EMOJI_SHORTCUTS, avatarColor, escapeHtml, formatTime, initialsForName } from './utils.js';
import { t } from './i18n.js';

const EMOJI_API_URL = 'https://raw.githubusercontent.com/github/gemoji/master/db/emoji.json';
const MAX_EMOJI_ITEMS = 96;

function highlightMentions(text, mentions = []) {
  let html = escapeHtml(text);
  mentions.forEach((name) => {
    const safe = escapeHtml(`@${name}`);
    html = html.split(safe).join(`<span class="chat-mention">${safe}</span>`);
  });
  html = html.replace(/(^|\s)(@[\p{L}\p{N}_-]{1,24})/gu, '$1<span class="chat-mention">$2</span>');
  return html;
}

function renderMessage(message) {
  const isSystem = message.kind === 'system';
  const avatarClass = avatarColor(message.username || message.kind);
  const avatar = `<div class="${avatarClass} chat-avatar">${escapeHtml(initialsForName(message.username || '系'))}</div>`;

  if (isSystem) {
    return `<div class="chat-system-message">${escapeHtml(message.text)} · ${formatTime(message.createdAt)}</div>`;
  }

  const isPrivate = message.channel === 'private';
  const privateLabel = isPrivate
    ? `<span class="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-300">${escapeHtml(t('privateChannel'))}${message.toUsername ? ` · ${escapeHtml(message.toUsername)}` : ''}</span>`
    : '';

  return `<article class="chat-message chat-message-card ${isPrivate ? 'is-private' : ''}"><div>${avatar}</div><div class="chat-message-body"><div class="chat-message-meta"><strong class="chat-message-name">${escapeHtml(message.username)}</strong>${privateLabel}<span class="chat-message-time">${formatTime(message.createdAt)}</span></div><p class="chat-message-text">${highlightMentions(message.text, message.mentions || [])}</p></div></article>`;
}

function createChatModule({
  chatList,
  chatForm,
  chatInput,
  clearChatButton,
  emojiToggleButton,
  emojiBar,
  typingStatusText,
  chatLengthText,
  jumpToLatestButton,
  privateSelect,
  mentionPopup,
  mentionHint,
  onSendMessage,
  onClearMessages,
  onUnreadMessage,
  onTypingStart,
  onTypingStop,
}) {
  let userPinnedHistory = false;
  let typingDebounceTimer = null;
  let selfTyping = false;
  let emojiExpanded = false;
  let emojiLoaded = false;
  let emojiItems = [];
  let privateTargetSocketId = '';
  let onlineUsers = [];
  let mentionOpen = false;
  let mentionQuery = '';
  let mentionStartIndex = -1;
  let mentionActiveIndex = 0;
  let mentionCandidates = [];

  function isNearBottom() {
    const distance = chatList.scrollHeight - (chatList.scrollTop + chatList.clientHeight);
    return distance <= 24;
  }

  function scrollToBottom(force = false) {
    if (force || !userPinnedHistory) {
      chatList.scrollTop = chatList.scrollHeight;
      userPinnedHistory = false;
    }
  }

  function updateJumpButton() {
    jumpToLatestButton.classList.toggle('hidden', !userPinnedHistory);
  }

  function renderMessages() {
    chatList.innerHTML = state.messages.map(renderMessage).join('');
    scrollToBottom(true);
    updateJumpButton();
  }

  function updateLengthHint() {
    const length = chatInput.value.length;
    chatLengthText.textContent = `${length} / 500`;
    chatLengthText.classList.toggle('text-amber-500', length >= 420);
    chatLengthText.classList.toggle('text-rose-500', length >= 480);
    chatLengthText.classList.toggle('text-slate-400', length < 420);
  }

  function updateTypingStatus() {
    const usernames = Array.from(state.typingUsers).filter((name) => name && name !== state.currentUser).slice(0, 2);

    if (!usernames.length) {
      typingStatusText.textContent = '';
      return;
    }

    typingStatusText.textContent = usernames.length === 1
      ? `${usernames[0]} 正在输入…`
      : `${usernames[0]}、${usernames[1]} 正在输入…`;
  }

  function appendMessage(message) {
    const shouldStick = isNearBottom();
    state.messages.push(message);
    if (state.messages.length > 200) {
      state.messages.shift();
    }

    chatList.innerHTML = state.messages.map(renderMessage).join('');

    if (shouldStick && !userPinnedHistory) {
      scrollToBottom(true);
    } else {
      userPinnedHistory = true;
      updateJumpButton();
    }

    onUnreadMessage(message);
  }

  function setMessages(messages) {
    state.messages = Array.isArray(messages) ? [...messages] : [];
    renderMessages();
  }

  function setTypingUsers(users) {
    state.typingUsers = new Set(Array.isArray(users) ? users : []);
    updateTypingStatus();
  }

  function clearMessagesLocally() {
    state.messages = [];
    renderMessages();
  }

  function otherUsers(users = onlineUsers) {
    return users.filter((user) => user.username && user.username !== state.currentUser);
  }

  function renderPrivateSelect() {
    if (!privateSelect) {
      return;
    }

    const others = otherUsers();
    const previous = privateTargetSocketId;
    const options = [
      `<option value="">${escapeHtml(t('noPrivate'))}</option>`,
      ...others.map((user) => (
        `<option value="${escapeHtml(user.socketId)}">${escapeHtml(t('privateTo'))} ${escapeHtml(user.username)}</option>`
      )),
    ];

    privateSelect.innerHTML = options.join('');

    if (previous && others.some((user) => user.socketId === previous)) {
      privateSelect.value = previous;
      privateTargetSocketId = previous;
    } else {
      privateSelect.value = '';
      privateTargetSocketId = '';
    }

    if (mentionHint) {
      const target = others.find((user) => user.socketId === privateTargetSocketId);
      mentionHint.textContent = target
        ? `${t('privateChannel')} · ${target.username}`
        : t('mentionHint');
    }
  }

  function updatePrivateTargets(users = []) {
    onlineUsers = Array.isArray(users) ? users : [];
    if (privateTargetSocketId && !onlineUsers.some((user) => user.socketId === privateTargetSocketId)) {
      privateTargetSocketId = '';
    }
    renderPrivateSelect();
    if (mentionOpen) {
      updateMentionPopup();
    }
  }

  function getMentionQueryAtCursor() {
    const value = chatInput.value;
    const cursor = Number.isInteger(chatInput.selectionStart) ? chatInput.selectionStart : value.length;
    const before = value.slice(0, cursor);
    const match = before.match(/(^|[\s([{（【])@([\p{L}\p{N}_-]{0,24})$/u);
    if (!match) {
      return null;
    }
    return {
      start: cursor - match[2].length - 1,
      query: match[2],
      cursor,
    };
  }

  function filterMentionCandidates(query) {
    const q = String(query || '').toLowerCase();
    return otherUsers().filter((user) => {
      const name = String(user.username || '').toLowerCase();
      return !q || name.includes(q) || name.startsWith(q);
    }).slice(0, 12);
  }

  function closeMentionPopup() {
    mentionOpen = false;
    mentionCandidates = [];
    mentionActiveIndex = 0;
    mentionStartIndex = -1;
    mentionQuery = '';
    if (mentionPopup) {
      mentionPopup.classList.add('hidden');
      mentionPopup.innerHTML = '';
      mentionPopup.setAttribute('aria-hidden', 'true');
    }
  }

  function renderMentionPopup() {
    if (!mentionPopup) {
      return;
    }

    if (!mentionOpen || !mentionCandidates.length) {
      mentionPopup.classList.add('hidden');
      mentionPopup.innerHTML = mentionOpen
        ? `<div class="px-3 py-2 text-xs text-slate-400">无匹配成员</div>`
        : '';
      if (mentionOpen) {
        mentionPopup.classList.remove('hidden');
      }
      return;
    }

    mentionPopup.classList.remove('hidden');
    mentionPopup.setAttribute('aria-hidden', 'false');
    mentionPopup.innerHTML = mentionCandidates.map((user, index) => (
      `<button type="button" class="chat-mention-item${index === mentionActiveIndex ? ' is-active' : ''}" data-mention-index="${index}">`
      + `<span class="chat-mention-avatar">${escapeHtml(initialsForName(user.username))}</span>`
      + `<span class="min-w-0 flex-1 truncate">${escapeHtml(user.username)}</span>`
      + `<span class="text-[10px] text-slate-400">${escapeHtml(user.deviceType || '')}</span>`
      + `</button>`
    )).join('');

    mentionPopup.querySelectorAll('[data-mention-index]').forEach((button) => {
      button.addEventListener('mousedown', (event) => {
        // Prevent textarea blur before click applies.
        event.preventDefault();
      });
      button.addEventListener('click', () => {
        const index = Number(button.getAttribute('data-mention-index'));
        applyMentionCandidate(index);
      });
    });

    const active = mentionPopup.querySelector('.chat-mention-item.is-active');
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  function updateMentionPopup() {
    const info = getMentionQueryAtCursor();
    if (!info) {
      closeMentionPopup();
      return;
    }

    mentionOpen = true;
    mentionStartIndex = info.start;
    mentionQuery = info.query;
    mentionCandidates = filterMentionCandidates(info.query);
    if (mentionActiveIndex >= mentionCandidates.length) {
      mentionActiveIndex = Math.max(0, mentionCandidates.length - 1);
    }
    renderMentionPopup();
  }

  function applyMentionCandidate(index = mentionActiveIndex) {
    const candidate = mentionCandidates[index];
    if (!candidate || mentionStartIndex < 0) {
      closeMentionPopup();
      return;
    }

    const value = chatInput.value;
    const cursor = Number.isInteger(chatInput.selectionStart) ? chatInput.selectionStart : value.length;
    const insert = `@${candidate.username} `;
    const nextValue = `${value.slice(0, mentionStartIndex)}${insert}${value.slice(cursor)}`;
    const nextCursor = mentionStartIndex + insert.length;
    chatInput.value = nextValue;
    chatInput.setSelectionRange(nextCursor, nextCursor);
    closeMentionPopup();
    updateLengthHint();
    chatInput.focus();
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function stopSelfTyping() {
    if (!selfTyping) {
      return;
    }

    selfTyping = false;
    onTypingStop();
  }

  function scheduleTypingStop() {
    if (typingDebounceTimer) {
      window.clearTimeout(typingDebounceTimer);
    }

    typingDebounceTimer = window.setTimeout(() => {
      stopSelfTyping();
    }, 1200);
  }

  function fallbackEmojiItems() {
    return EMOJI_SHORTCUTS.map((emoji) => ({
      emoji,
      label: emoji,
    }));
  }

  function normalizeEmojiPayload(payload) {
    if (!Array.isArray(payload)) {
      return [];
    }

    const seen = new Set();
    const normalized = [];

    for (const item of payload) {
      const emoji = String(item?.emoji || '').trim();

      if (!emoji || seen.has(emoji)) {
        continue;
      }

      seen.add(emoji);
      normalized.push({
        emoji,
        label: item?.description || item?.aliases?.[0] || emoji,
      });

      if (normalized.length >= MAX_EMOJI_ITEMS) {
        break;
      }
    }

    return normalized;
  }

  function renderEmojiBar() {
    emojiBar.innerHTML = emojiItems.map((item) => (`<button type="button" class="emoji-item-button rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" data-emoji="${escapeHtml(item.emoji)}" aria-label="${escapeHtml(item.label)}">${escapeHtml(item.emoji)}</button>`)).join('');

    emojiBar.querySelectorAll('[data-emoji]').forEach((button) => {
      button.addEventListener('click', () => {
        const emoji = button.dataset.emoji || '';
        const start = Number.isInteger(chatInput.selectionStart) ? chatInput.selectionStart : chatInput.value.length;
        const end = Number.isInteger(chatInput.selectionEnd) ? chatInput.selectionEnd : chatInput.value.length;
        const nextValue = `${chatInput.value.slice(0, start)}${emoji}${chatInput.value.slice(end)}`;
        const cursorPosition = start + emoji.length;
        chatInput.value = nextValue;
        chatInput.setSelectionRange(cursorPosition, cursorPosition);
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        chatInput.focus();
      });
    });
  }

  function setEmojiExpanded(nextValue) {
    emojiExpanded = Boolean(nextValue);
    emojiBar.classList.toggle('hidden', !emojiExpanded);
    emojiBar.style.display = emojiExpanded ? 'grid' : 'none';
    emojiBar.setAttribute('aria-hidden', emojiExpanded ? 'false' : 'true');

    if (emojiToggleButton) {
      emojiToggleButton.textContent = emojiExpanded ? '收起' : '表情';
      emojiToggleButton.setAttribute('aria-expanded', emojiExpanded ? 'true' : 'false');
    }
  }

  async function ensureEmojiLibraryLoaded() {
    if (emojiLoaded) {
      return;
    }

    if (emojiToggleButton) {
      emojiToggleButton.disabled = true;
      emojiToggleButton.textContent = '加载表情库...';
    }

    try {
      const response = await fetch(EMOJI_API_URL);

      if (!response.ok) {
        throw new Error('emoji api failed');
      }

      const payload = await response.json();
      emojiItems = normalizeEmojiPayload(payload);

      if (!emojiItems.length) {
        throw new Error('empty emoji list');
      }
    } catch (_error) {
      emojiItems = fallbackEmojiItems();
    } finally {
      emojiLoaded = true;
      renderEmojiBar();
      if (emojiToggleButton) {
        emojiToggleButton.disabled = false;
      }
    }
  }

  function init() {
    if (mentionHint) {
      mentionHint.textContent = t('mentionHint');
    }

    renderPrivateSelect();

    if (privateSelect) {
      privateSelect.addEventListener('change', () => {
        privateTargetSocketId = privateSelect.value || '';
        const target = otherUsers().find((user) => user.socketId === privateTargetSocketId);
        if (mentionHint) {
          mentionHint.textContent = target
            ? `${t('privateChannel')} · ${target.username}`
            : t('mentionHint');
        }
      });
    }

    if (emojiToggleButton) {
      setEmojiExpanded(false);
      emojiToggleButton.addEventListener('click', async () => {
        if (!emojiExpanded) {
          await ensureEmojiLibraryLoaded();
          setEmojiExpanded(true);
          return;
        }

        setEmojiExpanded(false);
      });
    } else {
      emojiItems = fallbackEmojiItems();
      renderEmojiBar();
      setEmojiExpanded(true);
    }

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (emojiExpanded && !target.closest('#emojiBar') && !target.closest('#emojiToggleButton')) {
        setEmojiExpanded(false);
      }

      if (mentionOpen && !target.closest('#mentionPopup') && !target.closest('#chatInput')) {
        closeMentionPopup();
      }
    });

    chatForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (mentionOpen && mentionCandidates.length) {
        applyMentionCandidate(mentionActiveIndex);
        return;
      }

      const text = chatInput.value.trim();

      if (!text) {
        return;
      }

      onSendMessage(text, privateTargetSocketId || '');
      chatInput.value = '';
      updateLengthHint();
      closeMentionPopup();
      stopSelfTyping();
      chatInput.focus();
    });

    chatInput.addEventListener('keydown', (event) => {
      if (mentionOpen) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          if (!mentionCandidates.length) {
            return;
          }
          mentionActiveIndex = (mentionActiveIndex + 1) % mentionCandidates.length;
          renderMentionPopup();
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (!mentionCandidates.length) {
            return;
          }
          mentionActiveIndex = (mentionActiveIndex - 1 + mentionCandidates.length) % mentionCandidates.length;
          renderMentionPopup();
          return;
        }

        if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey && mentionCandidates.length)) {
          event.preventDefault();
          applyMentionCandidate(mentionActiveIndex);
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          closeMentionPopup();
          return;
        }
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        chatForm.requestSubmit();
      }
    });

    chatInput.addEventListener('input', () => {
      updateLengthHint();
      updateMentionPopup();

      if (!selfTyping && chatInput.value.trim()) {
        selfTyping = true;
        onTypingStart();
      }

      if (!chatInput.value.trim()) {
        stopSelfTyping();
      } else {
        scheduleTypingStop();
      }
    });

    chatInput.addEventListener('click', () => {
      updateMentionPopup();
    });

    chatInput.addEventListener('keyup', (event) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        updateMentionPopup();
      }
    });

    chatInput.addEventListener('blur', () => {
      stopSelfTyping();
      // Delay so mention item click can fire first.
      window.setTimeout(() => {
        if (document.activeElement !== chatInput) {
          closeMentionPopup();
        }
      }, 120);
    });

    clearChatButton.addEventListener('click', () => {
      if (window.confirm('确定清空当前房间的聊天记录吗？')) {
        onClearMessages();
      }
    });

    chatList.addEventListener('scroll', () => {
      userPinnedHistory = !isNearBottom();
      updateJumpButton();
    });

    jumpToLatestButton.addEventListener('click', () => {
      scrollToBottom(true);
      updateJumpButton();
    });

    updateLengthHint();
    renderMessages();
    updateTypingStatus();
  }

  return {
    appendMessage,
    clearMessagesLocally,
    init,
    setMessages,
    setTypingUsers,
    updatePrivateTargets,
  };
}

export { createChatModule };

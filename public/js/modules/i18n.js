const STORAGE_KEY = 'syncboard-lang';

const LANG_ORDER = ['zh', 'zh-TW', 'en', 'ja'];

const LANG_LABELS = {
  zh: '简',
  'zh-TW': '繁',
  en: 'EN',
  ja: '日',
};

const LANG_HTML = {
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  en: 'en',
  ja: 'ja',
};

const DICTS = {
  zh: {
    appTitle: 'SyncBoard 内网通 Web 版',
    joinRoom: '加入房间',
    shareRoom: '分享房间 ▾',
    selectApp: '选择应用',
    whiteboard: '🎨 互动白板',
    monopoly: '🎲 大富翁',
    plane: '✈️ 飞行棋',
    currentUser: '当前用户',
    currentRoom: '当前房间',
    onlineCount: '在线人数',
    onlineDevices: '在线设备',
    currentApp: '当前应用',
    collabCenter: '协作中心',
    chatFilesClip: '聊天 / 文件 / 剪贴板',
    chat: '聊天',
    files: '文件',
    clipboard: '云剪贴板',
    recentActivity: '最近活动',
    publicChannel: '公共频道',
    clearChat: '清空聊天',
    sendMessage: '发送消息',
    privateChannel: '私聊',
    roomHistory: '房间历史',
    auditReport: '协作简报',
    brush: '画笔',
    eraser: '橡皮',
    undo: '撤销',
    redo: '重做',
    saveBoard: '保存白板',
    clearBoard: '清空白板',
    shapeRect: '矩形',
    shapeEllipse: '椭圆',
    shapeArrow: '箭头',
    textTool: '文字',
    selectTool: '选择',
    annotate: '标注截图',
    connected: '已连接',
    connecting: '连接中',
    disconnected: '已断开',
    reconnectBanner: '连接已断开，正在尝试重连…',
    reconnected: '已重新连接',
    mentionHint: '输入 @ 可提及在线成员',
    privateTo: '私聊给',
    noPrivate: '公共频道',
    language: '语言',
  },
  'zh-TW': {
    appTitle: 'SyncBoard 內網通 Web 版',
    joinRoom: '加入房間',
    shareRoom: '分享房間 ▾',
    selectApp: '選擇應用',
    whiteboard: '🎨 互動白板',
    monopoly: '🎲 大富翁',
    plane: '✈️ 飛行棋',
    currentUser: '目前使用者',
    currentRoom: '目前房間',
    onlineCount: '線上人數',
    onlineDevices: '線上裝置',
    currentApp: '目前應用',
    collabCenter: '協作中心',
    chatFilesClip: '聊天 / 檔案 / 剪貼簿',
    chat: '聊天',
    files: '檔案',
    clipboard: '雲剪貼簿',
    recentActivity: '最近活動',
    publicChannel: '公共頻道',
    clearChat: '清空聊天',
    sendMessage: '傳送訊息',
    privateChannel: '私訊',
    roomHistory: '房間歷史',
    auditReport: '協作簡報',
    brush: '畫筆',
    eraser: '橡皮擦',
    undo: '復原',
    redo: '重做',
    saveBoard: '儲存白板',
    clearBoard: '清空白板',
    shapeRect: '矩形',
    shapeEllipse: '橢圓',
    shapeArrow: '箭頭',
    textTool: '文字',
    selectTool: '選擇',
    annotate: '標註截圖',
    connected: '已連線',
    connecting: '連線中',
    disconnected: '已中斷',
    reconnectBanner: '連線已中斷，正在嘗試重新連線…',
    reconnected: '已重新連線',
    mentionHint: '輸入 @ 可提及線上成員',
    privateTo: '私訊給',
    noPrivate: '公共頻道',
    language: '語言',
  },
  en: {
    appTitle: 'SyncBoard LAN Suite',
    joinRoom: 'Join room',
    shareRoom: 'Share ▾',
    selectApp: 'Apps',
    whiteboard: '🎨 Whiteboard',
    monopoly: '🎲 Monopoly',
    plane: '✈️ Aeroplane',
    currentUser: 'User',
    currentRoom: 'Room',
    onlineCount: 'Online',
    onlineDevices: 'Devices',
    currentApp: 'App',
    collabCenter: 'Collaboration',
    chatFilesClip: 'Chat / Files / Clipboard',
    chat: 'Chat',
    files: 'Files',
    clipboard: 'Clipboard',
    recentActivity: 'Activity',
    publicChannel: 'Public',
    clearChat: 'Clear chat',
    sendMessage: 'Send',
    privateChannel: 'DM',
    roomHistory: 'Room history',
    auditReport: 'Audit brief',
    brush: 'Brush',
    eraser: 'Eraser',
    undo: 'Undo',
    redo: 'Redo',
    saveBoard: 'Save',
    clearBoard: 'Clear',
    shapeRect: 'Rect',
    shapeEllipse: 'Ellipse',
    shapeArrow: 'Arrow',
    textTool: 'Text',
    selectTool: 'Select',
    annotate: 'Annotate',
    connected: 'Connected',
    connecting: 'Connecting',
    disconnected: 'Disconnected',
    reconnectBanner: 'Disconnected — reconnecting…',
    reconnected: 'Reconnected',
    mentionHint: 'Type @ to mention someone',
    privateTo: 'DM to',
    noPrivate: 'Public channel',
    language: 'Language',
  },
  ja: {
    appTitle: 'SyncBoard 社内LANコラボ',
    joinRoom: 'ルームに参加',
    shareRoom: '共有 ▾',
    selectApp: 'アプリ',
    whiteboard: '🎨 ホワイトボード',
    monopoly: '🎲 モノポリー',
    plane: '✈️ 飛行棋',
    currentUser: 'ユーザー',
    currentRoom: 'ルーム',
    onlineCount: 'オンライン',
    onlineDevices: '端末',
    currentApp: 'アプリ',
    collabCenter: 'コラボセンター',
    chatFilesClip: 'チャット / ファイル / クリップボード',
    chat: 'チャット',
    files: 'ファイル',
    clipboard: 'クラウドCB',
    recentActivity: '最近の活動',
    publicChannel: '公開チャンネル',
    clearChat: 'チャットを消去',
    sendMessage: '送信',
    privateChannel: 'DM',
    roomHistory: 'ルーム履歴',
    auditReport: '作業レポート',
    brush: 'ブラシ',
    eraser: '消しゴム',
    undo: '元に戻す',
    redo: 'やり直し',
    saveBoard: '保存',
    clearBoard: 'クリア',
    shapeRect: '四角',
    shapeEllipse: '楕円',
    shapeArrow: '矢印',
    textTool: '文字',
    selectTool: '選択',
    annotate: '画面注釈',
    connected: '接続済み',
    connecting: '接続中',
    disconnected: '切断',
    reconnectBanner: '切断されました。再接続しています…',
    reconnected: '再接続しました',
    mentionHint: '@ でメンバーをメンション',
    privateTo: 'DM先',
    noPrivate: '公開チャンネル',
    language: '言語',
  },
};

let currentLang = 'zh';

function loadLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DICTS[stored]) {
      currentLang = stored;
    }
  } catch (_error) {
  }
  return currentLang;
}

function setLang(lang) {
  if (!DICTS[lang]) {
    return currentLang;
  }
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_error) {
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = LANG_HTML[lang] || 'zh-CN';
  }
  return currentLang;
}

function cycleLang() {
  const index = LANG_ORDER.indexOf(currentLang);
  const next = LANG_ORDER[(index + 1) % LANG_ORDER.length];
  return setLang(next);
}

function t(key) {
  return DICTS[currentLang]?.[key] || DICTS.zh[key] || key;
}

function getLang() {
  return currentLang;
}

function getLangLabel(lang = currentLang) {
  return LANG_LABELS[lang] || lang;
}

function getLangCycleLabel() {
  // e.g. 简→繁→EN→日
  return LANG_ORDER.map((code) => LANG_LABELS[code]).join('/');
}

loadLang();

export {
  t,
  setLang,
  cycleLang,
  getLang,
  getLangLabel,
  getLangCycleLabel,
  DICTS,
  LANG_ORDER,
};

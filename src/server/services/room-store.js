const { randomUUID } = require('crypto');
const { createRoomPersistence, hasDurableContent } = require('./room-persistence');

const MAX_OPERATIONS = 2000;
const MAX_MESSAGES = 200;
const MAX_FILES = 100;
const MAX_CLIPBOARD_ITEMS = 100;
const DEFAULT_PERSIST_DEBOUNCE_MS = 400;

function trimToLimit(items, maxLength, onTrim) {
  while (items.length > maxLength) {
    const removedItem = items.shift();

    if (onTrim && removedItem) {
      onTrim(removedItem);
    }
  }
}

function createRoomStore(options = {}) {
  const {
    persistDir = null,
    persistDebounceMs = DEFAULT_PERSIST_DEBOUNCE_MS,
    onFileEvicted = null,
  } = options;

  const rooms = new Map();
  const filesById = new Map();
  const filesByStoredName = new Map();
  const dirtyRooms = new Set();
  const saveTimers = new Map();

  const persistence = persistDir
    ? createRoomPersistence({ dataDir: persistDir })
    : null;

  function indexFile(fileMeta) {
    if (!fileMeta || !fileMeta.id || !fileMeta.storedName) {
      return;
    }

    filesById.set(fileMeta.id, fileMeta);
    filesByStoredName.set(fileMeta.storedName, fileMeta);
  }

  function unindexFile(fileMeta) {
    if (!fileMeta) {
      return;
    }

    if (fileMeta.id) {
      filesById.delete(fileMeta.id);
    }

    if (fileMeta.storedName) {
      filesByStoredName.delete(fileMeta.storedName);
    }
  }

  function createEmptyStats(seed = null) {
    return {
      strokes: Number(seed?.strokes) || 0,
      shapes: Number(seed?.shapes) || 0,
      texts: Number(seed?.texts) || 0,
      images: Number(seed?.images) || 0,
      messages: Number(seed?.messages) || 0,
      privateMessages: Number(seed?.privateMessages) || 0,
      files: Number(seed?.files) || 0,
      clears: Number(seed?.clears) || 0,
      joins: Number(seed?.joins) || 0,
      firstActivityAt: seed?.firstActivityAt || null,
      lastActivityAt: seed?.lastActivityAt || null,
    };
  }

  function touchStats(room, patch = {}) {
    if (!room.stats) {
      room.stats = createEmptyStats();
    }
    const now = new Date().toISOString();
    if (!room.stats.firstActivityAt) {
      room.stats.firstActivityAt = now;
    }
    room.stats.lastActivityAt = now;
    Object.entries(patch).forEach(([key, value]) => {
      if (typeof room.stats[key] === 'number' && typeof value === 'number') {
        room.stats[key] += value;
      }
    });
  }

  function createRuntimeRoom(roomId, durableState = null) {
    return {
      operations: Array.isArray(durableState?.operations) ? [...durableState.operations] : [],
      messages: Array.isArray(durableState?.messages) ? [...durableState.messages] : [],
      files: Array.isArray(durableState?.files) ? [...durableState.files] : [],
      clipboardItems: Array.isArray(durableState?.clipboardItems) ? [...durableState.clipboardItems] : [],
      users: new Map(),
      typingUsers: new Map(),
      stats: createEmptyStats(durableState?.stats),
    };
  }

  function hydrateRoom(roomId, durableState) {
    if (rooms.has(roomId)) {
      return rooms.get(roomId);
    }

    const room = createRuntimeRoom(roomId, durableState);
    rooms.set(roomId, room);

    room.files.forEach((fileMeta) => {
      indexFile(fileMeta);
    });

    return room;
  }

  function getDurableSnapshot(roomId) {
    const room = rooms.get(roomId);

    if (!room) {
      return null;
    }

    return {
      roomId,
      operations: [...room.operations],
      messages: [...room.messages],
      files: [...room.files],
      clipboardItems: [...room.clipboardItems],
      stats: { ...(room.stats || createEmptyStats()) },
    };
  }

  function clearSaveTimer(roomId) {
    const timer = saveTimers.get(roomId);

    if (timer) {
      clearTimeout(timer);
      saveTimers.delete(roomId);
    }
  }

  function persistRoomNow(roomId) {
    if (!persistence) {
      return;
    }

    clearSaveTimer(roomId);
    dirtyRooms.delete(roomId);

    const room = rooms.get(roomId);

    if (!room) {
      persistence.deleteRoom(roomId);
      return;
    }

    const durableSnapshot = getDurableSnapshot(roomId);

    if (!hasDurableContent(durableSnapshot)) {
      persistence.deleteRoom(roomId);
      return;
    }

    try {
      persistence.saveRoom(roomId, durableSnapshot);
    } catch (error) {
      console.warn(`[room-store] 持久化房间失败 ${roomId}: ${error.message}`);
      dirtyRooms.add(roomId);
    }
  }

  function schedulePersist(roomId) {
    if (!persistence) {
      return;
    }

    dirtyRooms.add(roomId);
    clearSaveTimer(roomId);

    const timer = setTimeout(() => {
      persistRoomNow(roomId);
    }, Math.max(0, Number(persistDebounceMs) || 0));

    // Do not keep the event loop alive solely for debounced writes.
    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    saveTimers.set(roomId, timer);
  }

  function getOrCreateRoom(roomId) {
    if (rooms.has(roomId)) {
      return rooms.get(roomId);
    }

    if (persistence) {
      const durableState = persistence.loadRoom(roomId);
      if (durableState) {
        return hydrateRoom(roomId, durableState);
      }
    }

    return hydrateRoom(roomId, null);
  }

  function getRoom(roomId) {
    return rooms.get(roomId) || null;
  }

  function getRoomSnapshot(roomId) {
    const room = getOrCreateRoom(roomId);

    return {
      roomId,
      operations: [...room.operations],
      messages: [...room.messages],
      files: [...room.files],
      clipboardItems: [...room.clipboardItems],
      users: Array.from(room.users.values()),
      count: room.users.size,
    };
  }

  function addUser(roomId, socketId, user) {
    const room = getOrCreateRoom(roomId);
    room.users.set(socketId, {
      socketId,
      ...user,
    });
  }

  function removeUser(roomId, socketId) {
    const room = getRoom(roomId);

    if (!room) {
      return null;
    }

    const user = room.users.get(socketId) || null;
    room.users.delete(socketId);
    room.typingUsers.delete(socketId);
    return user;
  }

  function listUsers(roomId) {
    const room = getOrCreateRoom(roomId);
    return Array.from(room.users.values());
  }

  function getUserCount(roomId) {
    const room = getRoom(roomId);
    return room ? room.users.size : 0;
  }

  function setTyping(roomId, socketId, username) {
    const room = getOrCreateRoom(roomId);

    if (!username) {
      room.typingUsers.delete(socketId);
      return;
    }

    room.typingUsers.set(socketId, username);
  }

  function clearTyping(roomId) {
    const room = getRoom(roomId);

    if (!room) {
      return;
    }

    room.typingUsers.clear();
  }

  function listTypingUsers(roomId) {
    const room = getRoom(roomId);

    if (!room) {
      return [];
    }

    return Array.from(new Set(Array.from(room.typingUsers.values())));
  }

  function addOperation(roomId, operation) {
    const room = getOrCreateRoom(roomId);
    room.operations.push(operation);
    trimToLimit(room.operations, MAX_OPERATIONS);
    if (operation?.type === 'stroke') {
      touchStats(room, { strokes: 1 });
    } else if (operation?.type === 'image') {
      touchStats(room, { images: 1 });
    } else if (operation?.type === 'shape') {
      touchStats(room, { shapes: 1 });
    } else if (operation?.type === 'text') {
      touchStats(room, { texts: 1 });
    }
    schedulePersist(roomId);
    return operation;
  }

  function removeOperation(roomId, operationId) {
    const room = getRoom(roomId);

    if (!room) {
      return null;
    }

    const index = room.operations.findIndex((operation) => operation.id === operationId);

    if (index < 0) {
      return null;
    }

    const [removed] = room.operations.splice(index, 1);
    schedulePersist(roomId);
    return removed || null;
  }

  function listOperations(roomId) {
    const room = getOrCreateRoom(roomId);
    return [...room.operations];
  }

  function clearOperations(roomId) {
    const room = getOrCreateRoom(roomId);
    room.operations = [];
    touchStats(room, { clears: 1 });
    schedulePersist(roomId);
  }

  function createMessage({
    kind,
    text,
    username = '',
    deviceType = '',
    fileId = '',
    mentions = [],
    channel = 'public',
    toUsername = '',
    toSocketId = '',
    fromSocketId = '',
  }) {
    return {
      id: randomUUID(),
      kind,
      text,
      username,
      deviceType,
      fileId,
      mentions: Array.isArray(mentions) ? mentions.slice(0, 12) : [],
      channel: channel === 'private' ? 'private' : 'public',
      toUsername: String(toUsername || '').slice(0, 24),
      toSocketId: String(toSocketId || '').slice(0, 80),
      fromSocketId: String(fromSocketId || '').slice(0, 80),
      createdAt: new Date().toISOString(),
    };
  }

  function addMessage(roomId, message) {
    const room = getOrCreateRoom(roomId);
    room.messages.push(message);
    trimToLimit(room.messages, MAX_MESSAGES);
    if (message?.kind === 'user') {
      touchStats(room, {
        messages: 1,
        privateMessages: message.channel === 'private' ? 1 : 0,
      });
    }
    schedulePersist(roomId);
    return message;
  }

  function clearMessages(roomId) {
    const room = getOrCreateRoom(roomId);
    room.messages = [];
    schedulePersist(roomId);
  }

  function deleteFileArtifacts(fileMeta) {
    unindexFile(fileMeta);

    if (typeof onFileEvicted === 'function' && fileMeta) {
      try {
        onFileEvicted(fileMeta);
      } catch (error) {
        console.warn(`[room-store] 删除上传文件失败: ${error.message}`);
      }
    }
  }

  function addFile(roomId, fileMeta) {
    const room = getOrCreateRoom(roomId);
    room.files.push(fileMeta);
    indexFile(fileMeta);
    trimToLimit(room.files, MAX_FILES, (removedFile) => {
      deleteFileArtifacts(removedFile);
    });
    touchStats(room, { files: 1 });
    schedulePersist(roomId);
    return fileMeta;
  }

  function recordJoin(roomId) {
    const room = getOrCreateRoom(roomId);
    touchStats(room, { joins: 1 });
    schedulePersist(roomId);
  }

  function listRoomSummaries() {
    const summaries = [];
    rooms.forEach((room, roomId) => {
      const stats = room.stats || createEmptyStats();
      summaries.push({
        roomId,
        onlineCount: room.users.size,
        operationCount: room.operations.length,
        messageCount: room.messages.length,
        fileCount: room.files.length,
        lastActivityAt: stats.lastActivityAt,
        stats,
      });
    });
    summaries.sort((left, right) => String(right.lastActivityAt || '').localeCompare(String(left.lastActivityAt || '')));
    return summaries;
  }

  function getRoomAudit(roomId) {
    const room = getRoom(roomId) || (persistence ? (() => {
      const durable = persistence.loadRoom(roomId);
      return durable ? hydrateRoom(roomId, durable) : null;
    })() : null);

    if (!room) {
      return null;
    }

    const stats = room.stats || createEmptyStats();
    return {
      roomId,
      onlineCount: room.users.size,
      operationCount: room.operations.length,
      messageCount: room.messages.length,
      fileCount: room.files.length,
      clipboardCount: room.clipboardItems.length,
      stats,
      generatedAt: new Date().toISOString(),
    };
  }

  function getFileById(fileId) {
    return filesById.get(fileId) || null;
  }

  function findFileByStoredName(storedName) {
    return filesByStoredName.get(storedName) || null;
  }

  function createClipboardItem({ roomId, text, username = '', deviceType = '', socketId = '' }) {
    return {
      id: randomUUID(),
      roomId,
      text,
      username,
      deviceType,
      socketId,
      createdAt: new Date().toISOString(),
    };
  }

  function addClipboardItem(roomId, clipboardItem) {
    const room = getOrCreateRoom(roomId);
    room.clipboardItems.push(clipboardItem);
    trimToLimit(room.clipboardItems, MAX_CLIPBOARD_ITEMS);
    schedulePersist(roomId);
    return clipboardItem;
  }

  function listClipboardItems(roomId) {
    const room = getOrCreateRoom(roomId);
    return [...room.clipboardItems];
  }

  function cleanupRoom(roomId) {
    const room = getRoom(roomId);

    if (!room) {
      return;
    }

    if (
      room.users.size === 0
      && room.operations.length === 0
      && room.messages.length === 0
      && room.files.length === 0
      && room.clipboardItems.length === 0
    ) {
      room.files.forEach((fileMeta) => {
        deleteFileArtifacts(fileMeta);
      });
      rooms.delete(roomId);
      clearSaveTimer(roomId);
      dirtyRooms.delete(roomId);

      if (persistence) {
        persistence.deleteRoom(roomId);
      }
    }
  }

  function loadPersistedRooms() {
    if (!persistence) {
      return {
        roomCount: 0,
        fileCount: 0,
      };
    }

    const persistedRooms = persistence.loadAllRooms();
    let fileCount = 0;

    persistedRooms.forEach((durableState, roomId) => {
      hydrateRoom(roomId, durableState);
      fileCount += durableState.files.length;
    });

    return {
      roomCount: persistedRooms.size,
      fileCount,
    };
  }

  function flushPersistence() {
    if (!persistence) {
      return {
        savedRooms: 0,
      };
    }

    const roomIds = new Set([
      ...dirtyRooms,
      ...saveTimers.keys(),
      ...Array.from(rooms.keys()).filter((roomId) => {
        const room = rooms.get(roomId);
        return room && hasDurableContent({
          operations: room.operations,
          messages: room.messages,
          files: room.files,
          clipboardItems: room.clipboardItems,
        });
      }),
    ]);

    roomIds.forEach((roomId) => {
      persistRoomNow(roomId);
    });

    return {
      savedRooms: roomIds.size,
    };
  }

  function getPersistenceInfo() {
    return {
      enabled: Boolean(persistence),
      dataDir: persistence?.roomsDir || null,
      roomCount: rooms.size,
      dirtyRoomCount: dirtyRooms.size,
    };
  }

  // Eagerly restore durable rooms so file downloads work before anyone rejoins.
  const bootStats = loadPersistedRooms();

  return {
    getRoomSnapshot,
    addUser,
    removeUser,
    listUsers,
    getUserCount,
    setTyping,
    clearTyping,
    listTypingUsers,
    addOperation,
    removeOperation,
    listOperations,
    clearOperations,
    createMessage,
    addMessage,
    clearMessages,
    addFile,
    getFileById,
    findFileByStoredName,
    createClipboardItem,
    addClipboardItem,
    listClipboardItems,
    cleanupRoom,
    flushPersistence,
    getPersistenceInfo,
    loadPersistedRooms,
    recordJoin,
    listRoomSummaries,
    getRoomAudit,
    bootStats,
  };
}

module.exports = {
  createRoomStore,
};

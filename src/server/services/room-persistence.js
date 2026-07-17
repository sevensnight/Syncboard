const fs = require('fs');
const path = require('path');
const { normalizeText } = require('../utils/text');

const PERSISTENCE_VERSION = 1;

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function toRoomFileName(roomId) {
  const normalizedRoomId = normalizeText(roomId, 'lobby', 32);
  return `${Buffer.from(normalizedRoomId, 'utf8').toString('base64url')}.json`;
}

function createEmptyDurableState(roomId) {
  return {
    version: PERSISTENCE_VERSION,
    roomId,
    operations: [],
    messages: [],
    files: [],
    clipboardItems: [],
    stats: null,
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeDurableState(roomId, rawState = {}) {
  const normalizedRoomId = normalizeText(roomId || rawState.roomId, 'lobby', 32);

  return {
    version: PERSISTENCE_VERSION,
    roomId: normalizedRoomId,
    operations: Array.isArray(rawState.operations) ? rawState.operations : [],
    messages: Array.isArray(rawState.messages) ? rawState.messages : [],
    files: Array.isArray(rawState.files) ? rawState.files : [],
    clipboardItems: Array.isArray(rawState.clipboardItems) ? rawState.clipboardItems : [],
    stats: rawState.stats && typeof rawState.stats === 'object' ? rawState.stats : null,
    updatedAt: rawState.updatedAt || new Date().toISOString(),
  };
}

function hasDurableContent(state) {
  if (!state) {
    return false;
  }

  return state.operations.length > 0
    || state.messages.length > 0
    || state.files.length > 0
    || state.clipboardItems.length > 0;
}

function createRoomPersistence({ dataDir }) {
  const roomsDir = path.resolve(dataDir);
  ensureDirectory(roomsDir);

  function getRoomFilePath(roomId) {
    return path.join(roomsDir, toRoomFileName(roomId));
  }

  function readJsonFile(filePath) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return null;
      }

      console.warn(`[room-persistence] 读取失败 ${filePath}: ${error.message}`);
      return null;
    }
  }

  function writeJsonAtomic(filePath, payload) {
    ensureDirectory(path.dirname(filePath));
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const serialized = `${JSON.stringify(payload, null, 2)}\n`;

    fs.writeFileSync(tempPath, serialized, 'utf8');
    fs.renameSync(tempPath, filePath);
  }

  function loadRoom(roomId) {
    const normalizedRoomId = normalizeText(roomId, 'lobby', 32);
    const filePath = getRoomFilePath(normalizedRoomId);
    const rawState = readJsonFile(filePath);

    if (!rawState) {
      return null;
    }

    return sanitizeDurableState(normalizedRoomId, rawState);
  }

  function loadAllRooms() {
    const rooms = new Map();

    let entries = [];
    try {
      entries = fs.readdirSync(roomsDir, { withFileTypes: true });
    } catch (error) {
      console.warn(`[room-persistence] 无法读取目录 ${roomsDir}: ${error.message}`);
      return rooms;
    }

    entries.forEach((entry) => {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        return;
      }

      const filePath = path.join(roomsDir, entry.name);
      const rawState = readJsonFile(filePath);

      if (!rawState) {
        return;
      }

      const roomId = normalizeText(rawState.roomId, '', 32);
      if (!roomId) {
        return;
      }

      const durableState = sanitizeDurableState(roomId, rawState);
      if (!hasDurableContent(durableState)) {
        return;
      }

      rooms.set(roomId, durableState);
    });

    return rooms;
  }

  function saveRoom(roomId, durableState) {
    const normalizedRoomId = normalizeText(roomId, 'lobby', 32);
    const nextState = sanitizeDurableState(normalizedRoomId, {
      ...durableState,
      updatedAt: new Date().toISOString(),
    });
    const filePath = getRoomFilePath(normalizedRoomId);

    if (!hasDurableContent(nextState)) {
      deleteRoom(normalizedRoomId);
      return null;
    }

    writeJsonAtomic(filePath, nextState);
    return nextState;
  }

  function deleteRoom(roomId) {
    const normalizedRoomId = normalizeText(roomId, 'lobby', 32);
    const filePath = getRoomFilePath(normalizedRoomId);

    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return false;
      }

      console.warn(`[room-persistence] 删除失败 ${filePath}: ${error.message}`);
      return false;
    }
  }

  return {
    createEmptyDurableState,
    deleteRoom,
    hasDurableContent,
    loadAllRooms,
    loadRoom,
    roomsDir,
    saveRoom,
    sanitizeDurableState,
  };
}

module.exports = {
  PERSISTENCE_VERSION,
  createEmptyDurableState,
  createRoomPersistence,
  hasDurableContent,
  sanitizeDurableState,
};

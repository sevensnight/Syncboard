const { randomUUID } = require('crypto');
const { normalizeText } = require('../utils/text');
const { detectDeviceType } = require('../utils/device');
const { createRateLimiter } = require('../utils/rate-limiter');

const MAX_CLIPBOARD_TEXT = 8000;
const MAX_STROKE_POINTS = 3000;
const REFRESH_RECONNECT_GRACE_MS = 2000;

function createPublicUser(socket, overrides = {}) {
  return {
    username: overrides.username || socket.data.username || '匿名用户',
    deviceType: overrides.deviceType || socket.data.deviceType || 'desktop',
    socketId: socket.id,
  };
}

function normalizeFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeRelativePoint(point) {
  const x = normalizeFiniteNumber(point?.x, 0);
  const y = normalizeFiniteNumber(point?.y, 0);

  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
}

function normalizeStrokePayload(payload = {}) {
  const coordinateSpace = normalizeText(payload.coordinateSpace, '', 16) === 'relative' ? 'relative' : null;
  const points = Array.isArray(payload.points)
    ? payload.points.slice(0, MAX_STROKE_POINTS)
      .map((point) => {
        if (coordinateSpace === 'relative') {
          return normalizeRelativePoint(point);
        }

        return {
          x: normalizeFiniteNumber(point?.x),
          y: normalizeFiniteNumber(point?.y),
        };
      })
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];

  if (points.length < 2) {
    return null;
  }

  const tool = normalizeText(payload.tool, 'brush', 16);
  const color = normalizeText(payload.color, '#111111', 16);
  const size = Math.max(1, Math.min(48, normalizeFiniteNumber(payload.size, 1)));

  const normalizedPayload = {
    tool,
    color,
    size,
    points,
  };

  if (coordinateSpace) {
    normalizedPayload.coordinateSpace = coordinateSpace;
  }

  return normalizedPayload;
}
function normalizeImagePayload(payload = {}) {
  const imageUrl = String(payload.imageUrl || '').trim().slice(0, 500);

  const isRelativeUpload = imageUrl.startsWith('/uploads/');
  const isHttpUrl = /^https?:\/\//i.test(imageUrl);

  if (!imageUrl || (!isRelativeUpload && !isHttpUrl)) {
    return null;
  }

  const width = Math.max(1, Math.min(8000, normalizeFiniteNumber(payload.width, 1)));
  const height = Math.max(1, Math.min(8000, normalizeFiniteNumber(payload.height, 1)));
  const scale = Math.max(0.1, Math.min(8, normalizeFiniteNumber(payload.scale, 1)));
  const coordinateSpace = normalizeText(payload.coordinateSpace, '', 16) === 'relative' ? 'relative' : null;

  if (coordinateSpace === 'relative') {
    const anchor = normalizeRelativePoint({ x: payload.x, y: payload.y });

    return {
      imageUrl,
      coordinateSpace,
      x: anchor.x,
      y: anchor.y,
      baseWidth: Math.max(1, Math.min(12000, normalizeFiniteNumber(payload.baseWidth, 1))),
      baseHeight: Math.max(1, Math.min(12000, normalizeFiniteNumber(payload.baseHeight, 1))),
      width,
      height,
      scale,
    };
  }

  const x = normalizeFiniteNumber(payload.x, 0);
  const y = normalizeFiniteNumber(payload.y, 0);

  return {
    imageUrl,
    x,
    y,
    width,
    height,
    scale,
  };
}

function normalizeShapePayload(payload = {}) {
  const shape = normalizeText(payload.shape, '', 16);
  if (!['rect', 'ellipse', 'arrow'].includes(shape)) {
    return null;
  }

  const coordinateSpace = normalizeText(payload.coordinateSpace, '', 16) === 'relative' ? 'relative' : null;
  const color = normalizeText(payload.color, '#111111', 16);
  const size = Math.max(1, Math.min(48, normalizeFiniteNumber(payload.size, 2)));

  if (shape === 'arrow') {
    const points = Array.isArray(payload.points) ? payload.points.slice(0, 2) : [];
    if (points.length < 2) {
      return null;
    }
    const mapped = points.map((point) => (
      coordinateSpace === 'relative'
        ? normalizeRelativePoint(point)
        : { x: normalizeFiniteNumber(point?.x), y: normalizeFiniteNumber(point?.y) }
    ));
    return {
      shape,
      color,
      size,
      ...(coordinateSpace ? { coordinateSpace } : {}),
      points: mapped,
    };
  }

  const x = coordinateSpace === 'relative'
    ? normalizeRelativePoint({ x: payload.x, y: payload.y }).x
    : normalizeFiniteNumber(payload.x);
  const y = coordinateSpace === 'relative'
    ? normalizeRelativePoint({ x: payload.x, y: payload.y }).y
    : normalizeFiniteNumber(payload.y);
  const width = Math.max(0.001, Math.min(coordinateSpace === 'relative' ? 1 : 8000, normalizeFiniteNumber(payload.width, 1)));
  const height = Math.max(0.001, Math.min(coordinateSpace === 'relative' ? 1 : 8000, normalizeFiniteNumber(payload.height, 1)));

  return {
    shape,
    color,
    size,
    x,
    y,
    width,
    height,
    ...(coordinateSpace ? { coordinateSpace } : {}),
  };
}

function normalizeTextPayload(payload = {}) {
  const text = String(payload.text || '').trim().slice(0, 200);
  if (!text) {
    return null;
  }

  const coordinateSpace = normalizeText(payload.coordinateSpace, '', 16) === 'relative' ? 'relative' : null;
  const color = normalizeText(payload.color, '#111111', 16);
  const fontSize = Math.max(10, Math.min(96, normalizeFiniteNumber(payload.fontSize, 18)));
  const point = coordinateSpace === 'relative'
    ? normalizeRelativePoint({ x: payload.x, y: payload.y })
    : { x: normalizeFiniteNumber(payload.x), y: normalizeFiniteNumber(payload.y) };

  return {
    text,
    color,
    fontSize,
    x: point.x,
    y: point.y,
    ...(coordinateSpace ? { coordinateSpace } : {}),
  };
}

function normalizeOperation(roomId, socket, operation = {}) {
  const operationType = normalizeText(operation.type, '', 16);
  const payload = operation && typeof operation.payload === 'object' ? operation.payload : {};

  if (!['stroke', 'image', 'shape', 'text'].includes(operationType)) {
    return null;
  }

  let normalizedPayload = null;
  if (operationType === 'stroke') {
    normalizedPayload = normalizeStrokePayload(payload);
  } else if (operationType === 'image') {
    normalizedPayload = normalizeImagePayload(payload);
  } else if (operationType === 'shape') {
    normalizedPayload = normalizeShapePayload(payload);
  } else if (operationType === 'text') {
    normalizedPayload = normalizeTextPayload(payload);
  }

  if (!normalizedPayload) {
    return null;
  }

  return {
    id: normalizeText(operation.id, randomUUID(), 80),
    type: operationType,
    roomId,
    username: socket.data.username || '匿名用户',
    deviceType: socket.data.deviceType || 'desktop',
    createdAt: new Date().toISOString(),
    payload: normalizedPayload,
  };
}

function extractMentions(text, roomUsers = []) {
  const names = roomUsers.map((user) => user.username).filter(Boolean);
  const found = [];
  names.forEach((name) => {
    if (text.includes(`@${name}`) && !found.includes(name)) {
      found.push(name);
    }
  });
  return found.slice(0, 12);
}

function registerRoomHandlers(io, roomStore) {
  const pendingLeaveBySession = new Map();
  const activeSocketBySession = new Map();
  const boardOpLimiter = createRateLimiter({ maxEvents: 40, windowMs: 1000 });
  const chatLimiter = createRateLimiter({ maxEvents: 12, windowMs: 1000 });
  const clipboardLimiter = createRateLimiter({ maxEvents: 8, windowMs: 1000 });

  function createSessionKey(roomId, sessionId) {
    return `${roomId}::${sessionId}`;
  }

  function getActiveSessionSocket(roomId, sessionId) {
    if (!roomId || !sessionId) {
      return null;
    }

    return activeSocketBySession.get(createSessionKey(roomId, sessionId)) || null;
  }

  function setActiveSessionSocket(roomId, sessionId, socketId) {
    if (!roomId || !sessionId || !socketId) {
      return;
    }

    activeSocketBySession.set(createSessionKey(roomId, sessionId), socketId);
  }

  function clearActiveSessionSocket(roomId, sessionId, socketId) {
    if (!roomId || !sessionId || !socketId) {
      return;
    }

    const key = createSessionKey(roomId, sessionId);

    if (activeSocketBySession.get(key) === socketId) {
      activeSocketBySession.delete(key);
    }
  }

  function takePendingLeave(roomId, sessionId) {
    if (!roomId || !sessionId) {
      return null;
    }

    const key = createSessionKey(roomId, sessionId);
    const pending = pendingLeaveBySession.get(key) || null;

    if (!pending) {
      return null;
    }

    clearTimeout(pending.timer);
    pendingLeaveBySession.delete(key);
    return pending;
  }

  function scheduleDelayedLeave({ roomId, socketId, username, deviceType, sessionId }) {
    if (!roomId || !socketId || !sessionId) {
      return;
    }

    const key = createSessionKey(roomId, sessionId);
    const previousPending = pendingLeaveBySession.get(key);

    if (previousPending) {
      clearTimeout(previousPending.timer);
    }

    const timer = setTimeout(() => {
      const pending = pendingLeaveBySession.get(key);

      if (!pending || pending.socketId !== socketId) {
        return;
      }

      if (getActiveSessionSocket(roomId, sessionId) && getActiveSessionSocket(roomId, sessionId) !== socketId) {
        pendingLeaveBySession.delete(key);
        return;
      }

      pendingLeaveBySession.delete(key);
      clearActiveSessionSocket(roomId, sessionId, socketId);
      roomStore.setTyping(roomId, socketId, null);
      broadcastTypingUsers(roomId);

      const removedUser = roomStore.removeUser(roomId, socketId);

      if (removedUser) {
        const leaveMessage = roomStore.createMessage({
          kind: 'system',
          text: `${username} 离开了房间`,
          username,
          deviceType,
        });

        roomStore.addMessage(roomId, leaveMessage);
        io.to(roomId).emit('chat-message', leaveMessage);
      }

      broadcastUsers(roomId);
      roomStore.cleanupRoom(roomId);
    }, REFRESH_RECONNECT_GRACE_MS);

    pendingLeaveBySession.set(key, {
      timer,
      roomId,
      socketId,
      username,
      deviceType,
      sessionId,
    });
  }


  function broadcastUsers(roomId) {
    io.to(roomId).emit('users-updated', {
      roomId,
      count: roomStore.getUserCount(roomId),
      users: roomStore.listUsers(roomId),
    });
  }

  function broadcastTypingUsers(roomId) {
    const typingUsers = roomStore.listTypingUsers(roomId);
    io.to(roomId).emit('typing-users', {
      roomId,
      users: typingUsers,
    });
  }

  function leaveCurrentRoom(socket) {
    const previousRoomId = socket.data.roomId;
    const sessionId = socket.data.sessionId || '';

    if (!previousRoomId) {
      return;
    }

    takePendingLeave(previousRoomId, sessionId);
    clearActiveSessionSocket(previousRoomId, sessionId, socket.id);
    roomStore.setTyping(previousRoomId, socket.id, null);
    broadcastTypingUsers(previousRoomId);

    const removedUser = roomStore.removeUser(previousRoomId, socket.id);
    socket.leave(previousRoomId);

    if (removedUser) {
      const leaveMessage = roomStore.createMessage({
        kind: 'system',
        text: `${removedUser.username} 离开了房间`,
        username: removedUser.username,
        deviceType: removedUser.deviceType,
      });

      roomStore.addMessage(previousRoomId, leaveMessage);
      io.to(previousRoomId).emit('chat-message', leaveMessage);
    }

    broadcastUsers(previousRoomId);
    roomStore.cleanupRoom(previousRoomId);
    socket.data.roomId = null;
  }


  io.on('connection', (socket) => {
    socket.data.deviceType = detectDeviceType(socket.handshake.headers['user-agent']);
    console.log(`用户已连接: ${socket.id}`);

    socket.on('join-room', ({ roomId, username, deviceType, sessionId } = {}) => {
      const nextRoomId = normalizeText(roomId, 'lobby', 32);
      const nextUsername = normalizeText(username, `用户-${socket.id.slice(0, 4)}`, 24);
      const nextDeviceType = normalizeText(deviceType, socket.data.deviceType || 'desktop', 16);
      const nextSessionId = normalizeText(sessionId, '', 80);
      const previousRoomId = socket.data.roomId;

      if (previousRoomId && previousRoomId !== nextRoomId) {
        leaveCurrentRoom(socket);
      }

      const resumedLeave = takePendingLeave(nextRoomId, nextSessionId);
      const existingSocketId = getActiveSessionSocket(nextRoomId, nextSessionId);

      if (resumedLeave && resumedLeave.socketId !== socket.id) {
        roomStore.setTyping(nextRoomId, resumedLeave.socketId, null);
        roomStore.removeUser(nextRoomId, resumedLeave.socketId);
      }

      if (existingSocketId && existingSocketId !== socket.id) {
        roomStore.setTyping(nextRoomId, existingSocketId, null);
        roomStore.removeUser(nextRoomId, existingSocketId);
      }

      socket.join(nextRoomId);
      socket.data.roomId = nextRoomId;
      socket.data.username = nextUsername;
      socket.data.deviceType = nextDeviceType;
      socket.data.sessionId = nextSessionId;

      if (nextSessionId) {
        setActiveSessionSocket(nextRoomId, nextSessionId, socket.id);
      }

      roomStore.addUser(nextRoomId, socket.id, createPublicUser(socket, {
        username: nextUsername,
        deviceType: nextDeviceType,
      }));

      const resumedSession = Boolean(
        (resumedLeave && resumedLeave.socketId !== socket.id)
        || (existingSocketId && existingSocketId !== socket.id),
      );

      if (!resumedSession) {
        const joinMessage = roomStore.createMessage({
          kind: 'system',
          text: `${nextUsername} 进入了房间`,
          username: nextUsername,
          deviceType: nextDeviceType,
        });

        roomStore.addMessage(nextRoomId, joinMessage);
        roomStore.recordJoin(nextRoomId);
        socket.to(nextRoomId).emit('chat-message', joinMessage);
      }

      const roomSnapshot = roomStore.getRoomSnapshot(nextRoomId);
      socket.emit('room-state', {
        roomId: nextRoomId,
        username: nextUsername,
        deviceType: nextDeviceType,
        operations: roomSnapshot.operations,
        messages: roomSnapshot.messages.filter((message) => (
          message.channel !== 'private'
          || message.fromSocketId === socket.id
          || message.toSocketId === socket.id
          || message.username === nextUsername
          || message.toUsername === nextUsername
        )),
        files: roomSnapshot.files,
        clipboardItems: roomSnapshot.clipboardItems,
        count: roomSnapshot.count,
        users: roomSnapshot.users,
        audit: roomStore.getRoomAudit(nextRoomId),
      });

      broadcastUsers(nextRoomId);
      broadcastTypingUsers(nextRoomId);
      console.log(`${nextUsername} 加入房间 ${nextRoomId}`);
    });

    socket.on('board-op:add', (rawOperation) => {
      const roomId = socket.data.roomId;

      if (!roomId) {
        return;
      }

      if (!boardOpLimiter.allow(socket.id)) {
        return;
      }

      const operation = normalizeOperation(roomId, socket, rawOperation);

      if (!operation) {
        return;
      }

      roomStore.addOperation(roomId, operation);
      io.to(roomId).emit('board-op:added', operation);
    });

    socket.on('board-op:remove', ({ operationId } = {}) => {
      const roomId = socket.data.roomId;
      const normalizedOperationId = normalizeText(operationId, '', 80);

      if (!roomId || !normalizedOperationId) {
        return;
      }

      if (!boardOpLimiter.allow(socket.id)) {
        return;
      }

      const removed = roomStore.removeOperation(roomId, normalizedOperationId);

      if (!removed) {
        return;
      }

      io.to(roomId).emit('board-op:removed', {
        roomId,
        operationId: normalizedOperationId,
      });
    });

    socket.on('clear', () => {
      const roomId = socket.data.roomId;

      if (!roomId) {
        return;
      }

      roomStore.clearOperations(roomId);
      io.to(roomId).emit('clear');
    });

    socket.on('chat-message', ({ text, toSocketId = '' } = {}) => {
      const roomId = socket.data.roomId;
      const messageText = normalizeText(text, '', 500);

      if (!roomId || !messageText) {
        return;
      }

      if (!chatLimiter.allow(socket.id)) {
        socket.emit('chat-message', roomStore.createMessage({
          kind: 'system',
          text: '发送过快，请稍后再试',
          username: '系统',
          deviceType: 'desktop',
        }));
        return;
      }

      roomStore.setTyping(roomId, socket.id, null);
      broadcastTypingUsers(roomId);

      const users = roomStore.listUsers(roomId);
      const mentions = extractMentions(messageText, users);
      const targetSocketId = normalizeText(toSocketId, '', 80);
      const targetUser = targetSocketId
        ? users.find((user) => user.socketId === targetSocketId)
        : null;

      if (targetSocketId && !targetUser) {
        socket.emit('chat-message', roomStore.createMessage({
          kind: 'system',
          text: '私聊对象已离线',
          username: '系统',
          deviceType: 'desktop',
        }));
        return;
      }

      const message = roomStore.createMessage({
        kind: 'user',
        text: messageText,
        username: socket.data.username || '匿名用户',
        deviceType: socket.data.deviceType || 'desktop',
        mentions,
        channel: targetUser ? 'private' : 'public',
        toUsername: targetUser?.username || '',
        toSocketId: targetUser?.socketId || '',
        fromSocketId: socket.id,
      });

      roomStore.addMessage(roomId, message);

      if (targetUser) {
        socket.emit('chat-message', message);
        io.to(targetUser.socketId).emit('chat-message', message);
        if (mentions.length) {
          io.to(targetUser.socketId).emit('chat-mention', {
            roomId,
            from: message.username,
            text: messageText,
          });
        }
      } else {
        io.to(roomId).emit('chat-message', message);
        if (mentions.length) {
          users.forEach((user) => {
            if (mentions.includes(user.username) && user.socketId !== socket.id) {
              io.to(user.socketId).emit('chat-mention', {
                roomId,
                from: message.username,
                text: messageText,
              });
            }
          });
        }
      }
    });

    socket.on('typing', ({ isTyping }) => {
      const roomId = socket.data.roomId;

      if (!roomId) {
        return;
      }

      if (isTyping) {
        roomStore.setTyping(roomId, socket.id, socket.data.username || '匿名用户');
      } else {
        roomStore.setTyping(roomId, socket.id, null);
      }

      broadcastTypingUsers(roomId);
    });

    socket.on('clipboard:send', ({ text } = {}) => {
      const roomId = socket.data.roomId;
      const normalizedText = String(text || '').trim().slice(0, MAX_CLIPBOARD_TEXT);

      if (!roomId || !normalizedText) {
        return;
      }

      if (!clipboardLimiter.allow(socket.id)) {
        return;
      }

      const item = roomStore.createClipboardItem({
        roomId,
        text: normalizedText,
        username: socket.data.username || '匿名用户',
        deviceType: socket.data.deviceType || 'desktop',
        socketId: socket.id,
      });

      roomStore.addClipboardItem(roomId, item);
      io.to(roomId).emit('clipboard:received', item);
    });

    socket.on('clear-messages', () => {
      const roomId = socket.data.roomId;

      if (!roomId) {
        return;
      }

      roomStore.clearMessages(roomId);
      roomStore.clearTyping(roomId);

      const clearedMessage = roomStore.createMessage({
        kind: 'system',
        text: `${socket.data.username || '匿名用户'} 清空了聊天记录`,
        username: socket.data.username || '匿名用户',
        deviceType: socket.data.deviceType || 'desktop',
      });

      roomStore.addMessage(roomId, clearedMessage);
      io.to(roomId).emit('messages-cleared');
      io.to(roomId).emit('chat-message', clearedMessage);
      broadcastTypingUsers(roomId);
    });

    socket.on('disconnect', () => {
      const username = socket.data.username || socket.id;
      const roomId = socket.data.roomId;
      const sessionId = socket.data.sessionId || '';

      boardOpLimiter.clear(socket.id);
      chatLimiter.clear(socket.id);
      clipboardLimiter.clear(socket.id);

      if (!roomId) {
        console.log(`用户已断开: ${username}`);
        return;
      }

      if (sessionId) {
        scheduleDelayedLeave({
          roomId,
          socketId: socket.id,
          username: socket.data.username || '匿名用户',
          deviceType: socket.data.deviceType || 'desktop',
          sessionId,
        });
      } else {
        leaveCurrentRoom(socket);
      }

      socket.data.roomId = null;
      console.log(`用户已断开: ${username}`);
    });
  });
}

module.exports = {
  registerRoomHandlers,
};

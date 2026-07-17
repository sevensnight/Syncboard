const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { createRoomStore } = require('./services/room-store');
const { createNetworkInfoRouter } = require('./routes/network-info');
const { createFilesRouter } = require('./routes/files');
const { createGameLauncherRouter, stopManagedGameProcesses } = require('./routes/game-launcher');
const { createRoomsRouter } = require('./routes/rooms');
const { registerRoomHandlers } = require('./socket/register-room-handlers');
const { getNetworkInfo } = require('./services/network-info');
const { isPathInside } = require('./utils/path-safety');

function createAppServer({ port, persistDir } = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const publicPath = path.join(__dirname, '..', '..', 'public');
  // Keep uploads inside the project root (src/server -> ../../uploads).
  const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');
  const roomDataDir = persistDir || path.join(__dirname, '..', '..', 'data', 'rooms');

  function deleteUploadFile(fileMeta) {
    if (!fileMeta?.relativePath) {
      return;
    }

    const absolutePath = path.resolve(uploadsRoot, fileMeta.relativePath);
    if (!isPathInside(uploadsRoot, absolutePath) || !fs.existsSync(absolutePath)) {
      return;
    }

    fs.unlinkSync(absolutePath);
  }

  const roomStore = createRoomStore({
    persistDir: roomDataDir,
    persistDebounceMs: 400,
    onFileEvicted: deleteUploadFile,
  });
  let shuttingDown = false;

  fs.mkdirSync(uploadsRoot, { recursive: true });
  fs.mkdirSync(roomDataDir, { recursive: true });

  app.use(express.static(publicPath));
  app.use('/uploads', express.static(uploadsRoot));
  app.get('/api/health', (_request, response) => {
    const persistenceInfo = roomStore.getPersistenceInfo();

    response.json({
      ok: true,
      service: 'syncboard',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      persistence: {
        enabled: persistenceInfo.enabled,
        roomCount: persistenceInfo.roomCount,
        dirtyRoomCount: persistenceInfo.dirtyRoomCount,
      },
    });
  });
  app.use('/api', createNetworkInfoRouter({ port }));
  app.use('/api', createFilesRouter({ uploadsRoot, roomStore, io }));
  app.use('/api', createRoomsRouter({ roomStore }));
  app.use('/api', createGameLauncherRouter());

  registerRoomHandlers(io, roomStore);

  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`收到 ${signal}，正在关闭 SyncBoard...`);

    try {
      const flushResult = roomStore.flushPersistence();
      console.log(`房间状态已落盘（${flushResult.savedRooms} 个房间）`);
    } catch (error) {
      console.warn(`房间状态落盘失败: ${error.message}`);
    }

    try {
      stopManagedGameProcesses();
    } catch (_error) {
      // Best-effort cleanup for child game processes.
    }

    await new Promise((resolve) => {
      server.close(() => resolve());
      // Force-close lingering sockets so shutdown never hangs.
      setTimeout(resolve, 1500).unref?.();
    });

    io.close();
  }

  async function start() {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '0.0.0.0', async () => {
        server.off('error', reject);

        try {
          const networkInfo = await getNetworkInfo({ port, roomId: 'lobby' });
          const bootStats = roomStore.bootStats || { roomCount: 0, fileCount: 0 };

          console.log(`SyncBoard 服务已启动: ${networkInfo.localhostUrl}`);
          console.log(`房间持久化: ${roomDataDir}（已恢复 ${bootStats.roomCount} 个房间 / ${bootStats.fileCount} 个文件索引）`);

          if (networkInfo.preferredLanUrl) {
            console.log(`朋友请访问 ${networkInfo.preferredLanUrl}`);
          } else {
            console.log('未检测到可用的内网 IPv4 地址，请确认当前设备已连接到局域网。');
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    const handleSignal = (signal) => {
      shutdown(signal)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    };

    process.once('SIGINT', () => handleSignal('SIGINT'));
    process.once('SIGTERM', () => handleSignal('SIGTERM'));
  }

  return {
    app,
    server,
    io,
    roomStore,
    start,
    shutdown,
  };
}

module.exports = {
  createAppServer,
};


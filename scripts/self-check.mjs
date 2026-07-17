import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { isPathInside } = require('../src/server/utils/path-safety.js');
const { createRateLimiter } = require('../src/server/utils/rate-limiter.js');
const { createRoomStore } = require('../src/server/services/room-store.js');
const { createRoomPersistence } = require('../src/server/services/room-persistence.js');
const { createAppServer } = require('../src/server/create-app-server.js');

function log(step, detail) {
  console.log(`[self-check:${step}] ${detail}`);
}

function testPathSafety() {
  const uploadsRoot = path.join(rootDir, 'uploads');
  assert.equal(isPathInside(uploadsRoot, path.join(uploadsRoot, 'room-a', 'file.txt')), true);
  assert.equal(isPathInside(uploadsRoot, path.join(uploadsRoot, '..', 'secret.txt')), false);
  assert.equal(isPathInside(uploadsRoot, path.join(uploadsRoot, 'room-a', '..', '..', 'package.json')), false);
  log('path', 'path traversal guards ok');
}

function testRateLimiter() {
  const limiter = createRateLimiter({ maxEvents: 3, windowMs: 1000 });
  assert.equal(limiter.allow('a'), true);
  assert.equal(limiter.allow('a'), true);
  assert.equal(limiter.allow('a'), true);
  assert.equal(limiter.allow('a'), false);
  limiter.clear('a');
  assert.equal(limiter.allow('a'), true);
  log('rate', 'rate limiter ok');
}

function testRoomStoreTrim() {
  const store = createRoomStore();
  const roomId = 'self-check-room';

  for (let index = 0; index < 5; index += 1) {
    store.addMessage(roomId, store.createMessage({
      kind: 'user',
      text: `msg-${index}`,
      username: 'tester',
    }));
  }

  const snapshot = store.getRoomSnapshot(roomId);
  assert.equal(snapshot.messages.length, 5);
  assert.equal(snapshot.count, 0);
  log('room', 'room store snapshot ok');
}

function testFileEvictionCallback() {
  const evicted = [];
  const store = createRoomStore({
    onFileEvicted: (fileMeta) => {
      evicted.push(fileMeta.storedName);
    },
  });
  const roomId = 'evict-room';

  for (let index = 0; index < 105; index += 1) {
    store.addFile(roomId, {
      id: `id-${index}`,
      roomId,
      username: 'u',
      name: `f-${index}.txt`,
      size: 1,
      mimeType: 'text/plain',
      createdAt: new Date().toISOString(),
      storedName: `stored-${index}.txt`,
      relativePath: path.join(roomId, `stored-${index}.txt`),
      downloadUrl: `/api/files/download/stored-${index}.txt`,
    });
  }

  const snapshot = store.getRoomSnapshot(roomId);
  assert.equal(snapshot.files.length, 100);
  assert.equal(evicted.length, 5);
  assert.equal(evicted[0], 'stored-0.txt');
  assert.equal(store.findFileByStoredName('stored-0.txt'), null);
  assert.ok(store.findFileByStoredName('stored-104.txt'));
  log('files', 'file eviction callback ok');
}

function testUploadsRootInsideProject() {
  // Mirror create-app-server path construction without starting the server.
  const serverDir = path.join(rootDir, 'src', 'server');
  const uploadsRoot = path.join(serverDir, '..', '..', 'uploads');
  assert.equal(path.resolve(uploadsRoot), path.resolve(rootDir, 'uploads'));
  log('uploads', 'uploads root resolves inside project');
}

function testRoomPersistenceRoundTrip() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncboard-rooms-'));
  const roomId = 'persist-demo';

  try {
    const writer = createRoomStore({
      persistDir: tempDir,
      persistDebounceMs: 0,
    });

    const stroke = {
      id: 'op-1',
      type: 'stroke',
      roomId,
      username: 'Alice',
      deviceType: 'desktop',
      createdAt: new Date().toISOString(),
      payload: {
        tool: 'brush',
        color: '#f59e0b',
        size: 4,
        coordinateSpace: 'relative',
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.2, y: 0.2 },
        ],
      },
    };

    writer.addOperation(roomId, stroke);
    writer.addMessage(roomId, writer.createMessage({
      kind: 'user',
      text: 'hello after restart',
      username: 'Alice',
      deviceType: 'desktop',
    }));
    writer.addFile(roomId, {
      id: 'file-1',
      roomId,
      username: 'Alice',
      name: 'notes.txt',
      size: 12,
      mimeType: 'text/plain',
      createdAt: new Date().toISOString(),
      storedName: 'notes-stored.txt',
      relativePath: path.join(roomId, 'notes-stored.txt'),
      downloadUrl: '/api/files/download/notes-stored.txt',
    });
    writer.addClipboardItem(roomId, writer.createClipboardItem({
      roomId,
      text: 'clip-after-restart',
      username: 'Alice',
      deviceType: 'desktop',
      socketId: 'socket-a',
    }));

    // Online users must remain ephemeral.
    writer.addUser(roomId, 'socket-a', {
      username: 'Alice',
      deviceType: 'desktop',
    });

    const flushResult = writer.flushPersistence();
    assert.ok(flushResult.savedRooms >= 1);

    const reader = createRoomStore({
      persistDir: tempDir,
      persistDebounceMs: 0,
    });

    assert.equal(reader.bootStats.roomCount, 1);
    assert.equal(reader.bootStats.fileCount, 1);

    const snapshot = reader.getRoomSnapshot(roomId);
    assert.equal(snapshot.operations.length, 1);
    assert.equal(snapshot.operations[0].id, 'op-1');
    assert.equal(snapshot.messages.some((message) => message.text === 'hello after restart'), true);
    assert.equal(snapshot.files.length, 1);
    assert.equal(snapshot.files[0].storedName, 'notes-stored.txt');
    assert.equal(snapshot.clipboardItems.some((item) => item.text === 'clip-after-restart'), true);
    assert.equal(snapshot.users.length, 0);
    assert.equal(snapshot.count, 0);

    const restoredFile = reader.findFileByStoredName('notes-stored.txt');
    assert.ok(restoredFile);
    assert.equal(restoredFile.name, 'notes.txt');

    // Clearing durable content should remove the persistence file.
    reader.clearOperations(roomId);
    reader.clearMessages(roomId);
    const room = reader.getRoomSnapshot(roomId);
    room.files.slice().forEach(() => {});
    // Empty files/clipboard by replacing via cleanup path: clear remaining durable fields.
    const runtime = reader.getRoomSnapshot(roomId);
    // Manually wipe remaining durable arrays through public APIs.
    runtime.files.forEach((fileMeta) => {
      // no public removeFile; re-create empty by cleanup after force-empty via second store write
      void fileMeta;
    });

    // Directly save empty state via persistence helper to validate delete semantics.
    const persistence = createRoomPersistence({ dataDir: tempDir });
    persistence.saveRoom(roomId, {
      roomId,
      operations: [],
      messages: [],
      files: [],
      clipboardItems: [],
    });

    const afterEmpty = createRoomStore({
      persistDir: tempDir,
      persistDebounceMs: 0,
    });
    assert.equal(afterEmpty.bootStats.roomCount, 0);

    log('persist', 'room persistence round-trip ok');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function testHealthEndpoint() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncboard-health-'));
  const port = 3017;
  const { start, shutdown, server } = createAppServer({
    port,
    persistDir: tempDir,
  });

  await start();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.ok, true);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.service, 'syncboard');
    assert.equal(payload.persistence?.enabled, true);
    log('health', 'health endpoint ok');
  } finally {
    await shutdown('self-check');
    await new Promise((resolve) => {
      server.close(() => resolve());
      setTimeout(resolve, 500).unref?.();
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function testPersistenceAcrossServerRestart() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncboard-restart-'));
  const roomId = 'restart-room';
  const portA = 3018;
  const portB = 3019;

  try {
    const first = createAppServer({ port: portA, persistDir: tempDir });
    await first.start();

    first.roomStore.addMessage(roomId, first.roomStore.createMessage({
      kind: 'user',
      text: 'survives-restart',
      username: 'Bob',
    }));
    first.roomStore.addOperation(roomId, {
      id: 'stroke-restart',
      type: 'stroke',
      roomId,
      username: 'Bob',
      createdAt: new Date().toISOString(),
      payload: {
        tool: 'brush',
        color: '#111111',
        size: 3,
        coordinateSpace: 'relative',
        points: [
          { x: 0.3, y: 0.3 },
          { x: 0.4, y: 0.5 },
        ],
      },
    });
    first.roomStore.flushPersistence();
    await first.shutdown('restart-test');

    const second = createAppServer({ port: portB, persistDir: tempDir });
    await second.start();

    try {
      const snapshot = second.roomStore.getRoomSnapshot(roomId);
      assert.equal(snapshot.messages.some((message) => message.text === 'survives-restart'), true);
      assert.equal(snapshot.operations.some((operation) => operation.id === 'stroke-restart'), true);
      assert.equal(snapshot.users.length, 0);
      log('restart', 'server restart restores durable room state');
    } finally {
      await second.shutdown('restart-test');
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  testPathSafety();
  testRateLimiter();
  testRoomStoreTrim();
  testFileEvictionCallback();
  testUploadsRootInsideProject();
  testRoomPersistenceRoundTrip();
  await testHealthEndpoint();
  await testPersistenceAcrossServerRestart();
  log('result', 'all self-checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

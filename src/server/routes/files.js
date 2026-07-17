const fs = require('fs');
const path = require('path');
const multer = require('multer');
const express = require('express');
const { randomUUID } = require('crypto');
const { sanitizeFilename, toSafeRoomSegment, normalizeText } = require('../utils/text');
const { isPathInside } = require('../utils/path-safety');

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function resolveRoomId(request) {
  return normalizeText(request.query.room || request.body.roomId, 'lobby', 32);
}

function createStorage(uploadsRoot) {
  return multer.diskStorage({
    destination(request, _file, callback) {
      const roomId = resolveRoomId(request);
      const roomDir = path.join(uploadsRoot, toSafeRoomSegment(roomId));
      ensureDirectory(roomDir);
      callback(null, roomDir);
    },
    filename(_request, file, callback) {
      const uniqueName = `${Date.now()}-${randomUUID()}-${sanitizeFilename(file.originalname)}`;
      callback(null, uniqueName);
    },
  });
}

function createPublicUploadUrl(filePathFromRoot) {
  // Relative URLs keep image sync working across localhost / LAN hosts.
  const relative = String(filePathFromRoot || '').replace(/\\/g, '/').replace(/^\/+/, '');
  return `/uploads/${relative}`;
}

function createFilesRouter({ uploadsRoot, roomStore, io }) {
  const router = express.Router();
  const storage = createStorage(uploadsRoot);

  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  });

  const uploadImage = multer({
    storage,
    limits: {
      fileSize: MAX_IMAGE_SIZE,
    },
    fileFilter(_request, file, callback) {
      if (!String(file.mimetype || '').startsWith('image/')) {
        callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'));
        return;
      }

      callback(null, true);
    },
  });

  router.post('/files/upload', upload.single('file'), (request, response) => {
    const roomId = resolveRoomId(request);
    const username = normalizeText(request.body.username, '匿名用户', 24);

    if (!request.file) {
      response.status(400).json({ message: '未收到文件。' });
      return;
    }

    const fileMeta = {
      id: randomUUID(),
      roomId,
      username,
      name: sanitizeFilename(request.file.originalname),
      size: request.file.size,
      mimeType: request.file.mimetype || 'application/octet-stream',
      createdAt: new Date().toISOString(),
      storedName: request.file.filename,
      relativePath: path.relative(uploadsRoot, request.file.path),
      downloadUrl: `/api/files/download/${path.basename(request.file.filename)}`,
    };

    roomStore.addFile(roomId, fileMeta);

    const systemMessage = roomStore.createMessage({
      kind: 'system',
      text: `${username} 上传了文件 ${fileMeta.name}`,
      username,
      fileId: fileMeta.id,
    });

    roomStore.addMessage(roomId, systemMessage);

    io.to(roomId).emit('file-added', fileMeta);
    io.to(roomId).emit('chat-message', systemMessage);

    response.json(fileMeta);
  });

  router.post('/images/upload', uploadImage.single('image'), (request, response) => {
    const roomId = resolveRoomId(request);

    if (!request.file) {
      response.status(400).json({ message: '未收到图片。' });
      return;
    }

    const relativePath = path.relative(uploadsRoot, request.file.path);

    response.json({
      roomId,
      storedName: request.file.filename,
      mimeType: request.file.mimetype || 'image/png',
      size: request.file.size,
      imageUrl: createPublicUploadUrl(relativePath),
      relativePath,
    });
  });

  router.get('/files/download/:storedName', (request, response) => {
    const storedName = path.basename(request.params.storedName);
    const matchedFile = roomStore.findFileByStoredName(storedName);

    if (!matchedFile) {
      response.status(404).json({ message: '文件不存在或已过期。' });
      return;
    }

    const absolutePath = path.resolve(uploadsRoot, matchedFile.relativePath);

    if (!isPathInside(uploadsRoot, absolutePath) || !fs.existsSync(absolutePath)) {
      response.status(404).json({ message: '文件不存在或已过期。' });
      return;
    }

    response.download(absolutePath, matchedFile.name);
  });

  router.use((error, _request, response, _next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      response.status(400).json({ message: '文件过大，请控制在限制大小以内。' });
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_UNEXPECTED_FILE') {
      response.status(400).json({ message: '仅支持上传图片文件。' });
      return;
    }

    if (error) {
      response.status(500).json({ message: '文件上传失败，请稍后重试。' });
      return;
    }
  });

  return router;
}

module.exports = {
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
  createFilesRouter,
};

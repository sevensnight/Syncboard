const express = require('express');

function createRoomsRouter({ roomStore }) {
  const router = express.Router();

  router.get('/rooms', (_request, response) => {
    response.json({
      rooms: roomStore.listRoomSummaries(),
    });
  });

  router.get('/rooms/:roomId/audit', (request, response) => {
    const summary = roomStore.getRoomAudit(request.params.roomId);
    if (!summary) {
      response.status(404).json({ message: '房间不存在或暂无数据' });
      return;
    }
    response.json(summary);
  });

  return router;
}

module.exports = {
  createRoomsRouter,
};

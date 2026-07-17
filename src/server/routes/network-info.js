const express = require('express');
const { getNetworkInfo } = require('../services/network-info');
const { normalizeText } = require('../utils/text');

function createNetworkInfoRouter({ port }) {
  const router = express.Router();

  router.get('/network-info', async (request, response) => {
    const roomId = normalizeText(request.query.room, 'lobby', 32);
    response.json(await getNetworkInfo({ port, roomId }));
  });

  return router;
}

module.exports = {
  createNetworkInfoRouter,
};

const express = require('express');
const fs = require('fs');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 3002;

const app = express();
const staticDir = path.join(__dirname, 'src', 'main', 'resources', 'static');
const indexTemplatePath = path.join(__dirname, 'src', 'main', 'webapp', 'WEB-INF', 'jsp', 'index.jsp');

app.use(express.static(staticDir));

app.get('/', (_request, response) => {
  if (!fs.existsSync(indexTemplatePath)) {
    response.status(500).send('飞行棋首页文件缺失');
    return;
  }

  const roomId = typeof _request.query.gameId === 'string' && _request.query.gameId.trim()
    ? _request.query.gameId.trim()
    : typeof _request.query.room === 'string' && _request.query.room.trim()
      ? _request.query.room.trim()
      : 'lobby';
  const username = typeof _request.query.username === 'string' && _request.query.username.trim()
    ? _request.query.username.trim()
    : '玩家';

  const template = fs.readFileSync(indexTemplatePath, 'utf8');
  const html = template
    .replace('var gameId = "${gameId}";', `var gameId = ${JSON.stringify(roomId)};`)
    .replace('var initialUsername = "${username}";', `var initialUsername = ${JSON.stringify(username)};`);

  response.type('html').send(html);
});

app.listen(PORT, HOST, () => {
  console.log(`Aeroplane Chess server listening on http://${HOST}:${PORT}`);
});

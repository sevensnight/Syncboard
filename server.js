const { createAppServer } = require('./src/server/create-app-server');

const PORT = 3000;
const { start } = createAppServer({ port: PORT });

start();

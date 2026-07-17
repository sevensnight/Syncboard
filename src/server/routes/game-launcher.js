const express = require('express');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const MONOPOLY_PORT = 3001;
const MONOPOLY_HOST = '127.0.0.1';
const MONOPOLY_START_TIMEOUT_MS = 40000;
const MONOPOLY_POLL_INTERVAL_MS = 500;

const PLANE_PORT = 3002;
const PLANE_HOST = '127.0.0.1';
const PLANE_START_TIMEOUT_MS = 120000;
const PLANE_POLL_INTERVAL_MS = 500;
const PLANE_WEBSOCKET_INFO_PATH = '/aeroplanechess-websocket/info';

const monopolyProjectDir = path.resolve(__dirname, '..', '..', '..', 'games', 'monopoly');
const monopolyPackageJson = path.join(monopolyProjectDir, 'package.json');
const monopolyNodeModules = path.join(monopolyProjectDir, 'node_modules');
const monopolyStartCommand = process.platform === 'win32' ? 'cmd.exe' : 'npm';
const monopolyStartArgs = process.platform === 'win32'
  ? [
      '/d',
      '/s',
      '/c',
      'npm',
      'run',
      'dev',
      '--',
      '--host',
      MONOPOLY_HOST,
      '--port',
      String(MONOPOLY_PORT),
      '--strictPort',
      '--base',
      '/Monopoly/',
    ]
  : [
      'run',
      'dev',
      '--',
      '--host',
      MONOPOLY_HOST,
      '--port',
      String(MONOPOLY_PORT),
      '--strictPort',
      '--base',
      '/Monopoly/',
    ];

const planeProjectDir = path.resolve(__dirname, '..', '..', '..', 'games', 'aeroplane-chess');
const planePomPath = path.join(planeProjectDir, 'pom.xml');
const planeJarPath = path.join(planeProjectDir, 'target', 'aeroplane-chess-1.1-rc.jar');
const planeLogPath = path.join(planeProjectDir, 'plane-start.log');
const planeJavaArgs = '--add-opens=java.base/java.lang=ALL-UNNAMED';
const planeServerArgs = `--server.port=${PLANE_PORT} --server.address=0.0.0.0`;

function buildPlaneStartShellCommand() {
  // Skip Maven package when jar already exists — cold start drops from minutes to seconds.
  const hasJar = fs.existsSync(planeJarPath);
  // Avoid quoting the relative jar path: cmd.exe + java on Windows treats quoted relative
  // paths as a different file and fails with "Unable to access jarfile".
  const javaCmd = `java ${planeJavaArgs} -jar target/aeroplane-chess-1.1-rc.jar ${planeServerArgs}`;
  if (hasJar) {
    return javaCmd;
  }
  return `mvn -DskipTests package && ${javaCmd}`;
}

const planeStartCommand = process.platform === 'win32' ? 'cmd.exe' : 'sh';


let monopolyStartupPromise = null;
let planeStartupPromise = null;
let monopolyProcess = null;
let planeProcess = null;

function stopProcessTree(processHandle) {
  if (!processHandle || processHandle.killed || processHandle.exitCode !== null) {
    return;
  }

  try {
    if (process.platform === 'win32' && processHandle.pid) {
      spawn('taskkill', ['/PID', String(processHandle.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      return;
    }

    processHandle.kill('SIGTERM');
  } catch (_error) {
    // Best-effort cleanup only.
  }
}

function stopManagedGameProcesses() {
  stopProcessTree(monopolyProcess);
  stopProcessTree(planeProcess);
  monopolyProcess = null;
  planeProcess = null;
  monopolyStartupPromise = null;
  planeStartupPromise = null;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function checkPortOpen(host, port, { timeoutMs = 800 } = {}) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const finish = (isOpen) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(isOpen);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));

    socket.connect(port, host);
  });
}

function isMonopolyPortOpen({ timeoutMs = 800 } = {}) {
  return checkPortOpen(MONOPOLY_HOST, MONOPOLY_PORT, { timeoutMs });
}

function isPlanePortOpen({ timeoutMs = 800 } = {}) {
  return checkPortOpen(PLANE_HOST, PLANE_PORT, { timeoutMs });
}

function checkHttpPathReady(host, port, pathToCheck, { timeoutMs = 1500 } = {}) {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host,
        port,
        path: pathToCheck,
        timeout: timeoutMs,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200 || response.statusCode === 204);
      },
    );

    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });

    request.on('error', () => {
      resolve(false);
    });
  });
}

async function isPlaneServiceReady({ timeoutMs = 1500 } = {}) {
  const portOpen = await isPlanePortOpen({ timeoutMs });
  if (!portOpen) {
    return false;
  }

  const pageReady = await checkHttpPathReady(PLANE_HOST, PLANE_PORT, '/', { timeoutMs });
  if (!pageReady) {
    return false;
  }

  return checkHttpPathReady(PLANE_HOST, PLANE_PORT, PLANE_WEBSOCKET_INFO_PATH, { timeoutMs });
}

async function waitForServiceReady({
  isReady,
  timeoutMs,
  pollIntervalMs,
  startErrorMessage,
  earlyExitMessage,
  timeoutMessage,
  getSpawnError,
  getExitInfo,
}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isReady()) {
      return;
    }

    const spawnError = getSpawnError();
    if (spawnError) {
      throw new Error(`${startErrorMessage}${spawnError.message}`);
    }

    const exitInfo = getExitInfo();
    if (exitInfo) {
      const codeInfo = exitInfo.code === null || exitInfo.code === undefined ? 'unknown' : String(exitInfo.code);
      const signalInfo = exitInfo.signal || 'none';
      throw new Error(`${earlyExitMessage}(code=${codeInfo}, signal=${signalInfo})`);
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(timeoutMessage);
}

async function waitForMonopolyReady({ getSpawnError, getExitInfo }) {
  await waitForServiceReady({
    isReady: isMonopolyPortOpen,
    timeoutMs: MONOPOLY_START_TIMEOUT_MS,
    pollIntervalMs: MONOPOLY_POLL_INTERVAL_MS,
    startErrorMessage: '启动大富翁失败：',
    earlyExitMessage: '大富翁启动进程提前退出',
    timeoutMessage: '等待大富翁服务启动超时，请检查 Node 环境与依赖安装状态。',
    getSpawnError,
    getExitInfo,
  });
}

async function waitForPlaneReady({ getSpawnError, getExitInfo }) {
  await waitForServiceReady({
    isReady: isPlaneServiceReady,
    timeoutMs: PLANE_START_TIMEOUT_MS,
    pollIntervalMs: PLANE_POLL_INTERVAL_MS,
    startErrorMessage: '启动飞行棋失败：',
    earlyExitMessage: '飞行棋启动进程提前退出',
    timeoutMessage: '等待飞行棋服务启动超时，请检查 Java/Maven 环境与依赖状态。',
    getSpawnError,
    getExitInfo,
  });
}

async function launchMonopolyProcess() {
  if (!fs.existsSync(monopolyProjectDir)) {
    throw new Error(`未找到大富翁目录：${monopolyProjectDir}`);
  }

  if (!fs.existsSync(monopolyPackageJson)) {
    throw new Error(`未找到 package.json：${monopolyPackageJson}`);
  }

  if (!fs.existsSync(monopolyNodeModules)) {
    throw new Error('大富翁依赖尚未安装，请先在 games/monopoly 目录执行 npm install。');
  }

  let spawnError = null;
  let exitInfo = null;

  const processHandle = spawn(monopolyStartCommand, monopolyStartArgs, {
    cwd: monopolyProjectDir,
    windowsHide: true,
    stdio: 'ignore',
  });

  monopolyProcess = processHandle;

  processHandle.once('error', (error) => {
    spawnError = error;
    if (monopolyProcess === processHandle) {
      monopolyProcess = null;
    }
  });

  processHandle.once('exit', (code, signal) => {
    exitInfo = { code, signal };
    if (monopolyProcess === processHandle) {
      monopolyProcess = null;
    }
  });

  processHandle.unref();

  try {
    await waitForMonopolyReady({
      getSpawnError: () => spawnError,
      getExitInfo: () => exitInfo,
    });
  } catch (error) {
    stopProcessTree(processHandle);
    if (monopolyProcess === processHandle) {
      monopolyProcess = null;
    }
    throw error;
  }

  return {
    ok: true,
    status: 'started',
  };
}

async function launchPlaneProcess() {
  if (!fs.existsSync(planeProjectDir)) {
    throw new Error(`未找到飞行棋目录：${planeProjectDir}`);
  }

  if (!fs.existsSync(planePomPath)) {
    throw new Error(`未找到飞行棋 Maven 配置：${planePomPath}`);
  }

  let spawnError = null;
  let exitInfo = null;
  const shellCommand = buildPlaneStartShellCommand();
  const planeStartArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', shellCommand]
    : ['-lc', shellCommand];

  let logFd = 'ignore';
  try {
    logFd = fs.openSync(planeLogPath, 'a');
    fs.writeSync(logFd, `\n==== plane start ${new Date().toISOString()} ====\n${shellCommand}\n`);
  } catch (_error) {
    logFd = 'ignore';
  }

  const processHandle = spawn(planeStartCommand, planeStartArgs, {
    cwd: planeProjectDir,
    windowsHide: true,
    stdio: logFd === 'ignore' ? 'ignore' : ['ignore', logFd, logFd],
  });

  planeProcess = processHandle;

  processHandle.once('error', (error) => {
    spawnError = error;
    if (planeProcess === processHandle) {
      planeProcess = null;
    }
  });

  processHandle.once('exit', (code, signal) => {
    exitInfo = { code, signal };
    if (planeProcess === processHandle) {
      planeProcess = null;
    }
    if (typeof logFd === 'number') {
      try {
        fs.closeSync(logFd);
      } catch (_error) {
        // ignore
      }
    }
  });

  processHandle.unref();

  try {
    await waitForPlaneReady({
      getSpawnError: () => spawnError,
      getExitInfo: () => exitInfo,
    });
  } catch (error) {
    stopProcessTree(processHandle);
    if (planeProcess === processHandle) {
      planeProcess = null;
    }
    const hint = fs.existsSync(planeLogPath)
      ? ` 详情见 ${planeLogPath}`
      : '';
    throw new Error(`${error.message}${hint}`);
  }

  return {
    ok: true,
    status: 'started',
    port: PLANE_PORT,
    jarExists: fs.existsSync(planeJarPath),
  };
}

async function ensureMonopolyRunning() {
  if (await isMonopolyPortOpen()) {
    return {
      ok: true,
      status: 'already-running',
    };
  }

  if (!monopolyStartupPromise) {
    monopolyStartupPromise = launchMonopolyProcess().finally(() => {
      monopolyStartupPromise = null;
    });
  }

  return monopolyStartupPromise;
}

async function ensurePlaneRunning() {
  if (await isPlaneServiceReady()) {
    return {
      ok: true,
      status: 'already-running',
      port: PLANE_PORT,
    };
  }

  if (!planeStartupPromise) {
    planeStartupPromise = launchPlaneProcess().finally(() => {
      planeStartupPromise = null;
    });
  }

  return planeStartupPromise;
}

function createGameLauncherRouter() {
  const router = express.Router();

  router.get('/start-game/monopoly', async (_request, response) => {
    try {
      const result = await ensureMonopolyRunning();
      response.json(result);
    } catch (error) {
      response.status(500).json({
        ok: false,
        status: 'failed',
        message: error instanceof Error ? error.message : '启动大富翁失败',
      });
    }
  });

  router.get('/start-game/plane', async (_request, response) => {
    try {
      const result = await ensurePlaneRunning();
      response.json({
        ...result,
        port: PLANE_PORT,
        // Room model: plane gameId is bound to SyncBoard room name on the client.
        roomMode: 'syncboard-room',
        hint: '飞行棋房间与 SyncBoard 当前房间名绑定；同一房间的人会进入同一局。',
      });
    } catch (error) {
      response.status(500).json({
        ok: false,
        status: 'failed',
        message: error instanceof Error ? error.message : '启动飞行棋失败',
      });
    }
  });

  // Browser-side connectivity probe helper (same-origin) for clearer errors.
  router.get('/plane-status', async (_request, response) => {
    const ready = await isPlaneServiceReady({ timeoutMs: 1200 });
    response.json({
      ok: ready,
      port: PLANE_PORT,
      host: PLANE_HOST,
    });
  });

  return router;
}

module.exports = {
  createGameLauncherRouter,
  stopManagedGameProcesses,
};

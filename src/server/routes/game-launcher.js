const express = require('express');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const gamesRoot = path.resolve(__dirname, '..', '..', '..', 'games');

/** @typedef {{
 *  id: string,
 *  label: string,
 *  port: number,
 *  host: string,
 *  startTimeoutMs: number,
 *  pollIntervalMs: number,
 *  projectDir: string,
 *  readyPath?: string,
 *  requireNodeModules?: boolean,
 *  packageJson?: string,
 *  buildMarker?: string,
 *  buildHint?: string,
 *  getStartCommand: () => { command: string, args: string[], shellCommand?: string, logPath?: string },
 * }} GameSpec */

/** @type {Record<string, GameSpec>} */
const GAME_SPECS = {
  monopoly: {
    id: 'monopoly',
    label: '大富翁',
    port: 3001,
    host: '127.0.0.1',
    startTimeoutMs: 40000,
    pollIntervalMs: 500,
    projectDir: path.join(gamesRoot, 'monopoly'),
    packageJson: path.join(gamesRoot, 'monopoly', 'package.json'),
    requireNodeModules: true,
    getStartCommand: () => {
      const host = '127.0.0.1';
      const port = 3001;
      const npmArgs = [
        'run', 'dev', '--',
        '--host', host,
        '--port', String(port),
        '--strictPort',
        '--base', '/Monopoly/',
      ];
      if (process.platform === 'win32') {
        return {
          command: 'cmd.exe',
          args: ['/d', '/s', '/c', 'npm', ...npmArgs],
        };
      }
      return { command: 'npm', args: npmArgs };
    },
  },
  plane: {
    id: 'plane',
    label: '飞行棋',
    port: 3002,
    host: '127.0.0.1',
    startTimeoutMs: 120000,
    pollIntervalMs: 500,
    projectDir: path.join(gamesRoot, 'aeroplane-chess'),
    readyPath: '/aeroplanechess-websocket/info',
    getStartCommand: () => {
      const projectDir = path.join(gamesRoot, 'aeroplane-chess');
      const jarPath = path.join(projectDir, 'target', 'aeroplane-chess-1.1-rc.jar');
      const javaArgs = '--add-opens=java.base/java.lang=ALL-UNNAMED';
      const serverArgs = '--server.port=3002 --server.address=0.0.0.0';
      const javaCmd = `java ${javaArgs} -jar target/aeroplane-chess-1.1-rc.jar ${serverArgs}`;
      const shellCommand = fs.existsSync(jarPath)
        ? javaCmd
        : `mvn -DskipTests package && ${javaCmd}`;
      const logPath = path.join(projectDir, 'plane-start.log');
      if (process.platform === 'win32') {
        return { command: 'cmd.exe', args: ['/d', '/s', '/c', shellCommand], shellCommand, logPath };
      }
      return { command: 'sh', args: ['-lc', shellCommand], shellCommand, logPath };
    },
  },
  uno: {
    id: 'uno',
    label: 'UNO',
    port: 3003,
    host: '127.0.0.1',
    startTimeoutMs: 30000,
    pollIntervalMs: 500,
    projectDir: path.join(gamesRoot, 'uno'),
    packageJson: path.join(gamesRoot, 'uno', 'package.json'),
    requireNodeModules: true,
    buildMarker: path.join(gamesRoot, 'uno', 'client', 'build', 'index.html'),
    buildHint: '请先在 games/uno/client 执行 npm install && npm run build',
    getStartCommand: () => {
      const envPrefix = process.platform === 'win32'
        ? 'set PORT=3003&& set HOST=0.0.0.0&& set NODE_ENV=production&&'
        : 'PORT=3003 HOST=0.0.0.0 NODE_ENV=production';
      const shellCommand = process.platform === 'win32'
        ? `${envPrefix} node server.js`
        : `${envPrefix} node server.js`;
      if (process.platform === 'win32') {
        return { command: 'cmd.exe', args: ['/d', '/s', '/c', shellCommand], shellCommand };
      }
      return { command: 'sh', args: ['-lc', shellCommand], shellCommand };
    },
  },
  skribbl: {
    id: 'skribbl',
    label: '你画我猜',
    port: 3004,
    host: '127.0.0.1',
    startTimeoutMs: 30000,
    pollIntervalMs: 500,
    projectDir: path.join(gamesRoot, 'skribbl'),
    packageJson: path.join(gamesRoot, 'skribbl', 'package.json'),
    requireNodeModules: true,
    getStartCommand: () => {
      const shellCommand = process.platform === 'win32'
        ? 'set PORT=3004&& set HOST=0.0.0.0&& node ./bin/www'
        : 'PORT=3004 HOST=0.0.0.0 node ./bin/www';
      if (process.platform === 'win32') {
        return { command: 'cmd.exe', args: ['/d', '/s', '/c', shellCommand], shellCommand };
      }
      return { command: 'sh', args: ['-lc', shellCommand], shellCommand };
    },
  },
};

/** @type {Record<string, import('child_process').ChildProcess | null>} */
const managedProcesses = {
  monopoly: null,
  plane: null,
  uno: null,
  skribbl: null,
};

/** @type {Record<string, Promise<any> | null>} */
const startupPromises = {
  monopoly: null,
  plane: null,
  uno: null,
  skribbl: null,
};

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
  Object.keys(managedProcesses).forEach((id) => {
    stopProcessTree(managedProcesses[id]);
    managedProcesses[id] = null;
    startupPromises[id] = null;
  });
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

/**
 * @param {GameSpec} spec
 */
async function isGameReady(spec, { timeoutMs = 1500 } = {}) {
  const portOpen = await checkPortOpen(spec.host, spec.port, { timeoutMs });
  if (!portOpen) {
    return false;
  }

  if (spec.id === 'plane') {
    const pageReady = await checkHttpPathReady(spec.host, spec.port, '/', { timeoutMs });
    if (!pageReady) {
      return false;
    }
    return checkHttpPathReady(spec.host, spec.port, spec.readyPath || '/', { timeoutMs });
  }

  // HTTP root for Node games (UNO / Skribbl / Monopoly Vite).
  if (spec.id === 'uno' || spec.id === 'skribbl' || spec.id === 'monopoly') {
    return checkHttpPathReady(spec.host, spec.port, '/', { timeoutMs });
  }

  return true;
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

/**
 * @param {GameSpec} spec
 */
async function launchGameProcess(spec) {
  if (!fs.existsSync(spec.projectDir)) {
    throw new Error(`未找到${spec.label}目录：${spec.projectDir}`);
  }

  if (spec.packageJson && !fs.existsSync(spec.packageJson)) {
    throw new Error(`未找到 package.json：${spec.packageJson}`);
  }

  if (spec.requireNodeModules) {
    const nm = path.join(spec.projectDir, 'node_modules');
    if (!fs.existsSync(nm)) {
      throw new Error(`${spec.label}依赖尚未安装，请先在 ${spec.projectDir} 执行 npm install。`);
    }
  }

  if (spec.buildMarker && !fs.existsSync(spec.buildMarker)) {
    throw new Error(`${spec.label}前端尚未构建。${spec.buildHint || ''}`);
  }

  // Plane-specific pom check
  if (spec.id === 'plane') {
    const pom = path.join(spec.projectDir, 'pom.xml');
    if (!fs.existsSync(pom)) {
      throw new Error(`未找到飞行棋 Maven 配置：${pom}`);
    }
  }

  let spawnError = null;
  let exitInfo = null;
  const start = spec.getStartCommand();

  let logFd = 'ignore';
  if (start.logPath) {
    try {
      logFd = fs.openSync(start.logPath, 'a');
      fs.writeSync(logFd, `\n==== ${spec.id} start ${new Date().toISOString()} ====\n${start.shellCommand || ''}\n`);
    } catch (_error) {
      logFd = 'ignore';
    }
  }

  const processHandle = spawn(start.command, start.args, {
    cwd: spec.projectDir,
    windowsHide: true,
    stdio: logFd === 'ignore' ? 'ignore' : ['ignore', logFd, logFd],
    env: {
      ...process.env,
      PORT: String(spec.port),
      HOST: '0.0.0.0',
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
  });

  managedProcesses[spec.id] = processHandle;

  processHandle.once('error', (error) => {
    spawnError = error;
    if (managedProcesses[spec.id] === processHandle) {
      managedProcesses[spec.id] = null;
    }
  });

  processHandle.once('exit', (code, signal) => {
    exitInfo = { code, signal };
    if (managedProcesses[spec.id] === processHandle) {
      managedProcesses[spec.id] = null;
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
    await waitForServiceReady({
      isReady: () => isGameReady(spec),
      timeoutMs: spec.startTimeoutMs,
      pollIntervalMs: spec.pollIntervalMs,
      startErrorMessage: `启动${spec.label}失败：`,
      earlyExitMessage: `${spec.label}启动进程提前退出`,
      timeoutMessage: `等待${spec.label}服务启动超时，请检查依赖与环境。`,
      getSpawnError: () => spawnError,
      getExitInfo: () => exitInfo,
    });
  } catch (error) {
    stopProcessTree(processHandle);
    if (managedProcesses[spec.id] === processHandle) {
      managedProcesses[spec.id] = null;
    }
    const hint = start.logPath && fs.existsSync(start.logPath)
      ? ` 详情见 ${start.logPath}`
      : '';
    throw new Error(`${error.message}${hint}`);
  }

  return {
    ok: true,
    status: 'started',
    port: spec.port,
    id: spec.id,
  };
}

/**
 * @param {string} gameId
 */
async function ensureGameRunning(gameId) {
  const spec = GAME_SPECS[gameId];
  if (!spec) {
    throw new Error(`未知游戏：${gameId}`);
  }

  if (await isGameReady(spec, { timeoutMs: 1200 })) {
    return {
      ok: true,
      status: 'already-running',
      port: spec.port,
      id: spec.id,
    };
  }

  if (!startupPromises[gameId]) {
    startupPromises[gameId] = launchGameProcess(spec).finally(() => {
      startupPromises[gameId] = null;
    });
  }

  return startupPromises[gameId];
}

function createGameLauncherRouter() {
  const router = express.Router();

  Object.keys(GAME_SPECS).forEach((gameId) => {
    const spec = GAME_SPECS[gameId];
    router.get(`/start-game/${gameId}`, async (_request, response) => {
      try {
        const result = await ensureGameRunning(gameId);
        response.json({
          ...result,
          port: spec.port,
          roomMode: 'syncboard-room',
          hint: `${spec.label}房间与 SyncBoard 当前房间名绑定；同一房间的人会进入同一局。`,
        });
      } catch (error) {
        response.status(500).json({
          ok: false,
          status: 'failed',
          message: error instanceof Error ? error.message : `启动${spec.label}失败`,
        });
      }
    });

    router.get(`/${gameId}-status`, async (_request, response) => {
      const ready = await isGameReady(spec, { timeoutMs: 1200 });
      response.json({
        ok: ready,
        port: spec.port,
        host: spec.host,
      });
    });
  });

  // Back-compat alias used by older clients
  router.get('/plane-status', async (_request, response) => {
    const ready = await isGameReady(GAME_SPECS.plane, { timeoutMs: 1200 });
    response.json({
      ok: ready,
      port: GAME_SPECS.plane.port,
      host: GAME_SPECS.plane.host,
    });
  });

  return router;
}

module.exports = {
  createGameLauncherRouter,
  stopManagedGameProcesses,
  GAME_SPECS,
};

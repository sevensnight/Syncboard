import { execSync } from 'node:child_process';
import process from 'node:process';

const TARGET_PORT = 3000;

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function parseWindowsListeningPids(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 5)
    .filter((parts) => {
      const localAddress = parts[1] || '';
      const state = parts[3] || '';
      return localAddress.endsWith(`:${TARGET_PORT}`) && state.toUpperCase() === 'LISTENING';
    })
    .map((parts) => Number(parts[4]))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function parseUnixListeningPids(output) {
  return output
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function killWindowsPid(pid) {
  run(`taskkill /PID ${pid} /F`);
}

function killUnixPid(pid) {
  run(`kill -9 ${pid}`);
}

function collectPids() {
  if (process.platform === 'win32') {
    const output = run('cmd /c netstat -ano -p tcp');
    return parseWindowsListeningPids(output);
  }

  const output = run(`lsof -ti tcp:${TARGET_PORT} -sTCP:LISTEN || true`);
  return parseUnixListeningPids(output);
}

function main() {
  const pids = Array.from(new Set(collectPids())).filter((pid) => pid !== process.pid);

  if (!pids.length) {
    console.log(`No LISTENING process found on port ${TARGET_PORT}.`);
    return;
  }

  console.log(`Found ${pids.length} process(es) on port ${TARGET_PORT}: ${pids.join(', ')}`);

  const killed = [];
  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        killWindowsPid(pid);
      } else {
        killUnixPid(pid);
      }
      killed.push(pid);
    } catch (_error) {
      console.log(`Failed to kill PID ${pid}.`);
    }
  }

  if (killed.length) {
    console.log(`Stopped PID(s): ${killed.join(', ')}`);
  } else {
    console.log('No process was stopped.');
  }
}

main();

import { chromium, devices } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const roomId = `e2e-${Date.now()}`;
const messageText = `hello-${Date.now()}`;
const uploadName = `upload-${Date.now()}.txt`;
const clipboardText = `clipboard-${Date.now()}`;

function log(step, detail) {
  console.log(`[${step}] ${detail}`);
}

const CONNECT_TIMEOUT = 20000;
const JOIN_TIMEOUT = 9000;
const JOIN_MAX_ATTEMPTS = 3;

async function waitForConnected(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.getElementById('connectionBadge')?.textContent?.includes('已连接'),
    null,
    { timeout: CONNECT_TIMEOUT },
  );
}

async function waitForRoomIdentity(page, room, username, timeout = JOIN_TIMEOUT) {
  await page.waitForFunction(({ expectedRoom, expectedUser }) => {
    return document.getElementById('currentRoomText')?.textContent?.trim() === expectedRoom
      && document.getElementById('currentUserText')?.textContent?.trim() === expectedUser;
  }, { expectedRoom: room, expectedUser: username }, { timeout });
}

async function joinRoom(page, username, room) {
  const usernameInput = page.locator('#usernameInput');

  for (let attempt = 1; attempt <= JOIN_MAX_ATTEMPTS; attempt += 1) {
    if (!(await usernameInput.isVisible())) {
      await page.click('#joinRoomPopoverButton');
      await usernameInput.waitFor({ state: 'visible', timeout: JOIN_TIMEOUT });
    }

    await page.fill('#usernameInput', username);
    await page.fill('#roomInput', room);
    await page.press('#roomInput', 'Enter');

    try {
      await waitForRoomIdentity(page, room, username);
      return;
    } catch (error) {
      if (attempt === JOIN_MAX_ATTEMPTS) {
        const actual = await page.evaluate(() => ({
          room: document.getElementById('currentRoomText')?.textContent?.trim() || '',
          user: document.getElementById('currentUserText')?.textContent?.trim() || '',
          connection: document.getElementById('connectionBadge')?.textContent?.trim() || '',
        }));

        throw new Error(
          `Join room failed after ${JOIN_MAX_ATTEMPTS} attempts. Expected room=${room}, user=${username}. `
          + `Actual room=${actual.room}, user=${actual.user}, connection=${actual.connection}.`,
        );
      }

      await page.waitForTimeout(350);
    }
  }
}

async function waitForOnlineCount(page, expected) {
  await page.waitForFunction((count) => document.getElementById('onlineCountText')?.textContent?.trim() === String(count), expected);
}

async function countRoomTransitionMessages(page, username) {
  return page.evaluate((name) => {
    const text = document.getElementById('chatList')?.textContent || '';
    const enterNeedle = `${name} 进入了房间`;
    const leaveNeedle = `${name} 离开了房间`;

    return {
      enter: text.split(enterNeedle).length - 1,
      leave: text.split(leaveNeedle).length - 1,
    };
  }, username);
}

async function canvasDataUrl(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('board');
    return canvas.toDataURL('image/png');
  });
}

async function waitForCanvasChange(page, previousDataUrl) {
  await page.waitForFunction((previous) => {
    const canvas = document.getElementById('board');
    return canvas && canvas.toDataURL('image/png') !== previous;
  }, previousDataUrl);
}

async function ensureDesktopSidebarOpen(page) {
  const sidebar = page.locator('#sidebar');

  if (await sidebar.evaluate((element) => element.classList.contains('is-collapsed'))) {
    await page.click('#desktopSidebarToggleButton');
    await page.waitForFunction(() => !document.getElementById('sidebar')?.classList.contains('is-collapsed'));
  }
}

async function drawStroke(page) {
  const board = page.locator('#board');
  await board.scrollIntoViewIfNeeded();
  const box = await board.boundingBox();

  if (!box) {
    throw new Error('Canvas bounding box not found');
  }

  const startX = box.x + box.width * 0.6;
  const startY = box.y + box.height * 0.5;
  const endX = Math.min(box.x + box.width - 24, startX + 170);
  const endY = Math.min(box.y + box.height - 24, startY + 80);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 16 });
  await page.mouse.up();
}

async function dropGeneratedImage(page) {
  const box = await page.locator('#board').boundingBox();

  if (!box) {
    throw new Error('Canvas bounding box not found');
  }

  const clientX = box.x + Math.min(220, box.width * 0.3);
  const clientY = box.y + Math.min(180, box.height * 0.3);

  await page.evaluate(({ x, y }) => {
    const board = document.getElementById('board');
    if (!board) {
      throw new Error('Canvas not found');
    }

    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Yf8AAAAASUVORK5CYII=';
    const binary = atob(pngBase64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const file = new File([bytes], 'tiny.png', { type: 'image/png' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    board.dispatchEvent(new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
      clientX: x,
      clientY: y,
    }));

    board.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
      clientX: x,
      clientY: y,
    }));
  }, { x: clientX, y: clientY });
}

async function validateDesktopFlows(browser) {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 960 } });
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  await waitForConnected(pageA);
  await waitForConnected(pageB);
  log('desktop', 'both pages connected');

  await joinRoom(pageA, 'Alpha', roomId);
  await joinRoom(pageB, 'Beta', roomId);
  await ensureDesktopSidebarOpen(pageA);
  await ensureDesktopSidebarOpen(pageB);

  const transitionCountBeforeRefresh = await countRoomTransitionMessages(pageB, 'Alpha');
  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.waitForFunction((expectedRoom) => {
    return document.getElementById('currentRoomText')?.textContent?.trim() === expectedRoom;
  }, roomId);
  await pageA.waitForFunction(() => document.getElementById('connectionBadge')?.textContent?.includes('已连接'));
  await ensureDesktopSidebarOpen(pageA);
  await pageB.waitForTimeout(2600);
  const transitionCountAfterRefresh = await countRoomTransitionMessages(pageB, 'Alpha');

  if (transitionCountAfterRefresh.enter !== transitionCountBeforeRefresh.enter
    || transitionCountAfterRefresh.leave !== transitionCountBeforeRefresh.leave) {
    throw new Error('Refresh produced unexpected leave/join system messages');
  }

  log('desktop', 'refresh reconnect messaging verified');
  await pageA.fill('#chatInput', messageText);
  await pageA.click('#chatForm button[type="submit"]');
  await pageB.waitForFunction((text) => document.getElementById('chatList')?.textContent?.includes(text), messageText);
  log('desktop', 'chat sync verified');

  const boardBeforeStrokeA = await canvasDataUrl(pageA);
  const boardBeforeStrokeB = await canvasDataUrl(pageB);
  await drawStroke(pageA);
  await waitForCanvasChange(pageA, boardBeforeStrokeA);
  await waitForCanvasChange(pageB, boardBeforeStrokeB);
  const boardAfterFirstStroke = await canvasDataUrl(pageB);
  log('desktop', 'whiteboard stroke sync verified');

  const boardBeforeSecondStrokeA = await canvasDataUrl(pageA);
  await drawStroke(pageA);
  await waitForCanvasChange(pageA, boardBeforeSecondStrokeA);
  await waitForCanvasChange(pageB, boardAfterFirstStroke);
  const boardAfterTwoStrokes = await canvasDataUrl(pageB);

  await pageA.click('#undoButton');
  await pageB.waitForFunction((expected) => {
    const canvas = document.getElementById('board');
    return canvas?.toDataURL('image/png') === expected;
  }, boardAfterFirstStroke);

  await pageA.click('#redoButton');
  await pageB.waitForFunction((expected) => {
    const canvas = document.getElementById('board');
    return canvas?.toDataURL('image/png') === expected;
  }, boardAfterTwoStrokes);
  log('desktop', 'undo and redo sync verified');

  const boardBeforeImageA = await canvasDataUrl(pageA);
  const boardBeforeImageB = await canvasDataUrl(pageB);
  await dropGeneratedImage(pageA);
  await waitForCanvasChange(pageA, boardBeforeImageA);
  await waitForCanvasChange(pageB, boardBeforeImageB);
  await pageB.waitForFunction(() => document.getElementById('activityList')?.textContent?.includes('插入了一张图片'));
  log('desktop', 'image drop and sync verified');

  await pageA.click('#clipboardTabButton');
  await pageA.fill('#clipboardInput', clipboardText);
  await pageA.click('#sendClipboardButton');

  await pageB.click('#clipboardTabButton');
  await pageB.waitForFunction((text) => document.getElementById('clipboardList')?.textContent?.includes(text), clipboardText);
  await pageB.waitForFunction(() => document.getElementById('clipboardToasts')?.childElementCount > 0);
  log('desktop', 'clipboard sync verified');

  const exportButton = await pageA.locator('#saveBoardButton').isVisible()
    ? '#saveBoardButton'
    : '#saveBoardButtonMirror';

  const [exportDownload] = await Promise.all([
    pageA.waitForEvent('download'),
    pageA.click(exportButton),
  ]);

  if (!exportDownload.suggestedFilename().endsWith('.png')) {
    throw new Error(`Unexpected export filename: ${exportDownload.suggestedFilename()}`);
  }

  await exportDownload.cancel();
  log('desktop', 'png export verified');

  const toolbarPanel = pageA.locator('#toolbarPanel');
  await pageA.click('#fabButton');
  await toolbarPanel.waitFor({ state: 'hidden' });
  await pageA.click('#fabButton');
  await toolbarPanel.waitFor({ state: 'visible' });
  log('desktop', 'toolbar toggle verified');

  const wasDark = await pageA.evaluate(() => document.documentElement.classList.contains('dark'));
  await pageA.click('#themeToggleButton');
  await pageA.waitForFunction((previous) => document.documentElement.classList.contains('dark') !== previous, wasDark);
  const toggledDark = await pageA.evaluate(() => document.documentElement.classList.contains('dark'));
  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.waitForFunction((expected) => document.documentElement.classList.contains('dark') === expected, toggledDark);
  await ensureDesktopSidebarOpen(pageA);
  await ensureDesktopSidebarOpen(pageB);
  log('desktop', 'theme persistence verified');

  await pageA.click('#filesTabButton');
  await pageB.click('#filesTabButton');
  await pageA.setInputFiles('#uploadInput', {
    name: uploadName,
    mimeType: 'text/plain',
    buffer: Buffer.from(`playwright upload ${Date.now()}\n`, 'utf8'),
  });
  await pageB.waitForFunction((name) => document.getElementById('fileList')?.textContent?.includes(name), uploadName);
  log('desktop', 'file upload broadcast verified');

  const fileCard = pageB.locator('#fileList article', { hasText: uploadName }).first();
  const [download] = await Promise.all([
    pageB.waitForEvent('download'),
    fileCard.locator('button[data-download]').click(),
  ]);

  if (download.suggestedFilename() !== uploadName) {
    throw new Error(`Unexpected download filename: ${download.suggestedFilename()}`);
  }

  await download.cancel();
  log('desktop', 'file download trigger verified');

  await context.close();
}

async function validateMobileFlows(browser) {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    acceptDownloads: true,
  });
  const page = await context.newPage();

  await waitForConnected(page);
  await joinRoom(page, 'Mobile', `${roomId}-m`);

  await page.click('#mobileMenuButton');
  await page.waitForFunction(() => document.getElementById('sidebar')?.classList.contains('translate-x-0'));
  await page.click('#sidebarBackdrop');
  await page.waitForFunction(() => document.getElementById('sidebar')?.classList.contains('translate-x-full'));
  log('mobile', 'sidebar drawer verified');

  await page.waitForFunction(() => !document.getElementById('toolbarDrawer')?.classList.contains('hidden'));
  await page.click('#fabButton');
  await page.waitForFunction(() => document.getElementById('toolbarDrawer')?.classList.contains('hidden'));
  await page.click('#fabButton');
  await page.waitForFunction(() => !document.getElementById('toolbarDrawer')?.classList.contains('hidden'));
  log('mobile', 'toolbar drawer toggle verified');

  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    await validateDesktopFlows(browser);
    await validateMobileFlows(browser);
    log('result', 'all browser checks passed');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
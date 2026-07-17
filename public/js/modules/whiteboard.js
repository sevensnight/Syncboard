import { state } from './state.js';
import { clamp } from './utils.js';

const POINTER_MOVE_MIN_DISTANCE = 0.7;

function createOperationId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizePoint(point) {
  return {
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2)),
  };
}

function toRelativePoint(point, width, height) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);

  return {
    x: Number(clamp(point.x / safeWidth, 0, 1).toFixed(5)),
    y: Number(clamp(point.y / safeHeight, 0, 1).toFixed(5)),
  };
}

function fromRelativePoint(point, width, height) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);

  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
    return null;
  }

  return {
    x: Number((clamp(rawX, 0, 1) * safeWidth).toFixed(2)),
    y: Number((clamp(rawY, 0, 1) * safeHeight).toFixed(2)),
  };
}

function resolveOperationPoints(payload, width, height) {
  if (!payload || !Array.isArray(payload.points)) {
    return [];
  }

  if (payload.coordinateSpace === 'relative') {
    return payload.points
      .map((point) => fromRelativePoint(point, width, height))
      .filter(Boolean);
  }

  return payload.points
    .map((point) => {
      const x = Number(point?.x);
      const y = Number(point?.y);

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      return { x, y };
    })
    .filter(Boolean);
}

function distanceBetweenPoints(fromPoint, toPoint) {
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  return Math.hypot(dx, dy);
}

function midpoint(fromPoint, toPoint) {
  return {
    x: (fromPoint.x + toPoint.x) / 2,
    y: (fromPoint.y + toPoint.y) / 2,
  };
}

function buildSmoothedPoints(points, size) {
  if (!Array.isArray(points) || points.length < 2) {
    return [];
  }

  const normalized = [normalizePoint(points[0])];

  for (let index = 1; index < points.length; index += 1) {
    const previous = normalized[normalized.length - 1];
    const current = normalizePoint(points[index]);
    const distance = distanceBetweenPoints(previous, current);

    if (distance < POINTER_MOVE_MIN_DISTANCE) {
      continue;
    }

    const interpolationStep = clamp(size * 0.35, 0.8, 2.8);
    const interpolationCount = Math.max(1, Math.ceil(distance / interpolationStep));

    for (let step = 1; step <= interpolationCount; step += 1) {
      const ratio = step / interpolationCount;
      normalized.push({
        x: Number((previous.x + (current.x - previous.x) * ratio).toFixed(2)),
        y: Number((previous.y + (current.y - previous.y) * ratio).toFixed(2)),
      });
    }
  }

  return normalized;
}

function createWhiteboardModule({
  canvas,
  brushButtons,
  eraserButtons,
  clearButtons,
  undoButtons,
  redoButtons,
  colorPickers,
  colorSwatches,
  brushSizeInputs,
  brushSizeValue,
  shapeRectButtons = [],
  shapeEllipseButtons = [],
  shapeArrowButtons = [],
  textButtons = [],
  selectButtons = [],
  annotateButtons = [],
  annotateInput = null,
  onAddOperation,
  onRemoveOperation,
  onClear,
  onUploadImage,
  onError,
}) {
  const context = canvas.getContext('2d');
  context.lineCap = 'round';
  context.lineJoin = 'round';

  const imageCache = new Map();
  const swatches = Array.isArray(colorSwatches) ? colorSwatches : [];
  let redrawVersion = 0;
  let currentStrokePoints = [];
  let currentStrokeStyle = null;
  let activePointerId = null;
  let resizeObserver = null;
  let resizeFrame = null;
  let lastCanvasWidth = 0;
  let lastCanvasHeight = 0;
  let strokeSnapshot = null;
  let strokeSnapshotRefreshPromise = null;
  let selectedOperationId = null;
  let selectionDrag = null;

  function getClientPoint(event) {
    if (event?.touches?.length) {
      return {
        clientX: event.touches[0].clientX,
        clientY: event.touches[0].clientY,
      };
    }

    if (event?.changedTouches?.length) {
      return {
        clientX: event.changedTouches[0].clientX,
        clientY: event.changedTouches[0].clientY,
      };
    }

    return {
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  function getPointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const { clientX, clientY } = getClientPoint(event);
    const scaleX = canvas.width / Math.max(rect.width, 1);
    const scaleY = canvas.height / Math.max(rect.height, 1);

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function updateToolButtons() {
    const tool = state.currentTool;
    const map = [
      [brushButtons, 'brush'],
      [eraserButtons, 'eraser'],
      [shapeRectButtons, 'rect'],
      [shapeEllipseButtons, 'ellipse'],
      [shapeArrowButtons, 'arrow'],
      [textButtons, 'text'],
      [selectButtons, 'select'],
    ];
    map.forEach(([buttons, name]) => {
      buttons.forEach((button) => {
        button.classList.toggle('is-active', tool === name);
      });
    });
  }

  function updateColorSwatches() {
    swatches.forEach((swatch) => {
      const swatchColor = String(swatch.dataset.colorSwatch || '').toLowerCase();
      const active = swatchColor === state.currentColor.toLowerCase();
      swatch.classList.toggle('is-active', active);
      swatch.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function syncControls() {
    colorPickers.forEach((picker) => {
      picker.value = state.currentColor;
    });

    brushSizeInputs.forEach((input) => {
      input.value = String(state.currentSize);
    });

    brushSizeValue.textContent = `${state.currentSize}px`;
    updateColorSwatches();
    updateToolButtons();
  }

  function applyStrokeStyle(style) {
    context.globalCompositeOperation = style.tool === 'eraser' ? 'destination-out' : 'source-over';
    context.lineWidth = style.size;
    context.strokeStyle = style.tool === 'eraser' ? 'rgba(0,0,0,1)' : style.color;
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }

  function drawSmoothedPath(points, style) {
    if (!Array.isArray(points) || points.length < 2) {
      return;
    }

    context.save();
    applyStrokeStyle(style);
    context.beginPath();

    if (points.length === 2) {
      context.moveTo(points[0].x, points[0].y);
      context.lineTo(points[1].x, points[1].y);
    } else {
      context.moveTo(points[0].x, points[0].y);

      for (let index = 1; index < points.length - 1; index += 1) {
        const control = points[index];
        const next = points[index + 1];
        const end = midpoint(control, next);
        context.quadraticCurveTo(control.x, control.y, end.x, end.y);
      }

      const penultimate = points[points.length - 2];
      const last = points[points.length - 1];
      context.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y);
    }

    context.stroke();
    context.closePath();
    context.restore();
  }

  function renderStrokeOperation(operation) {
    const payload = operation?.payload;

    if (!payload) {
      return;
    }

    const operationPoints = resolveOperationPoints(payload, canvas.width, canvas.height);

    if (operationPoints.length < 2) {
      return;
    }

    const style = {
      tool: payload.tool || 'brush',
      color: payload.color,
      size: clamp(Number(payload.size) || 1, 1, 48),
    };

    const smoothedPoints = buildSmoothedPoints(operationPoints, style.size);
    drawSmoothedPath(smoothedPoints, style);
  }

  function loadImage(imageUrl) {
    if (!imageCache.has(imageUrl)) {
      imageCache.set(imageUrl, new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('图片加载失败'));
        image.src = imageUrl;
      }));
    }

    return imageCache.get(imageUrl);
  }

  async function renderImageOperation(operation) {
    const payload = operation?.payload;

    if (!payload?.imageUrl) {
      return;
    }

    try {
      const image = await loadImage(payload.imageUrl);
      const width = Math.max(1, Number(payload.width) || image.naturalWidth || 1);
      const height = Math.max(1, Number(payload.height) || image.naturalHeight || 1);
      const scale = clamp(Number(payload.scale) || 1, 0.1, 8);

      if (payload.coordinateSpace === 'relative') {
        const baseWidth = Math.max(1, Number(payload.baseWidth) || canvas.width);
        const baseHeight = Math.max(1, Number(payload.baseHeight) || canvas.height);
        const anchor = fromRelativePoint({ x: payload.x, y: payload.y }, canvas.width, canvas.height);

        if (!anchor) {
          return;
        }

        const widthRatio = canvas.width / baseWidth;
        const heightRatio = canvas.height / baseHeight;
        const renderedScale = scale * Math.min(widthRatio, heightRatio);

        context.drawImage(image, anchor.x, anchor.y, width * renderedScale, height * renderedScale);
        return;
      }

      context.drawImage(image, payload.x, payload.y, width * scale, height * scale);
    } catch (_error) {
      onError('图片渲染失败', '请确认图片地址可访问');
    }
  }

  function renderShapeOperation(operation) {
    const payload = operation?.payload;
    if (!payload?.shape) {
      return;
    }

    context.save();
    context.strokeStyle = payload.color || '#111111';
    context.lineWidth = clamp(Number(payload.size) || 2, 1, 48);
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (payload.shape === 'arrow') {
      const points = resolveOperationPoints({
        coordinateSpace: payload.coordinateSpace,
        points: payload.points,
      }, canvas.width, canvas.height);
      if (points.length < 2) {
        context.restore();
        return;
      }
      const [from, to] = points;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const head = 12 + context.lineWidth;
      context.beginPath();
      context.moveTo(to.x, to.y);
      context.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
      context.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
      context.closePath();
      context.fillStyle = payload.color || '#111111';
      context.fill();
      context.restore();
      return;
    }

    let x = Number(payload.x) || 0;
    let y = Number(payload.y) || 0;
    let width = Number(payload.width) || 0;
    let height = Number(payload.height) || 0;
    if (payload.coordinateSpace === 'relative') {
      x *= canvas.width;
      y *= canvas.height;
      width *= canvas.width;
      height *= canvas.height;
    }
    if (width < 0) {
      x += width;
      width = Math.abs(width);
    }
    if (height < 0) {
      y += height;
      height = Math.abs(height);
    }

    context.beginPath();
    if (payload.shape === 'ellipse') {
      context.ellipse(x + width / 2, y + height / 2, Math.max(1, width / 2), Math.max(1, height / 2), 0, 0, Math.PI * 2);
    } else {
      context.rect(x, y, Math.max(1, width), Math.max(1, height));
    }
    context.stroke();
    context.restore();
  }

  function renderTextOperation(operation) {
    const payload = operation?.payload;
    if (!payload?.text) {
      return;
    }

    let x = Number(payload.x) || 0;
    let y = Number(payload.y) || 0;
    if (payload.coordinateSpace === 'relative') {
      x *= canvas.width;
      y *= canvas.height;
    }
    const fontSize = clamp(Number(payload.fontSize) || 18, 10, 96);
    context.save();
    context.fillStyle = payload.color || '#111111';
    context.font = `600 ${fontSize}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    context.fillText(String(payload.text), x, y);
    context.restore();
  }


  function captureStrokeSnapshot() {
    try {
      strokeSnapshot = context.getImageData(0, 0, canvas.width, canvas.height);
    } catch (_error) {
      strokeSnapshot = null;
    }
  }

  function restoreStrokeSnapshot() {
    if (!strokeSnapshot) {
      return false;
    }

    if (strokeSnapshot.width !== canvas.width || strokeSnapshot.height !== canvas.height) {
      strokeSnapshot = null;
      return false;
    }

    context.putImageData(strokeSnapshot, 0, 0);
    return true;
  }

  function clearStrokeSnapshot() {
    strokeSnapshot = null;
    strokeSnapshotRefreshPromise = null;
  }

  function paintCurrentStrokePreview() {
    if (!currentStrokeStyle || currentStrokePoints.length < 2) {
      return;
    }

    const previewPoints = buildSmoothedPoints(currentStrokePoints, currentStrokeStyle.size);
    drawSmoothedPath(previewPoints, currentStrokeStyle);
  }

  async function redrawFromOperations({ preserveStrokePreview = false } = {}) {
    const currentVersion = ++redrawVersion;
    context.clearRect(0, 0, canvas.width, canvas.height);

    for (const operation of state.boardOperations) {
      if (currentVersion !== redrawVersion) {
        return false;
      }

      if (operation.type === 'stroke') {
        renderStrokeOperation(operation);
      } else if (operation.type === 'image') {
        await renderImageOperation(operation);
      } else if (operation.type === 'shape') {
        renderShapeOperation(operation);
      } else if (operation.type === 'text') {
        renderTextOperation(operation);
      }
    }

    if (currentVersion !== redrawVersion) {
      return false;
    }

    if (preserveStrokePreview && state.isDrawing && !selectionDrag) {
      captureStrokeSnapshot();
      paintCurrentStrokePreview();
    }

    paintSelectionOutline();
    return true;
  }

  function getOperationBounds(operation) {
    if (!operation?.payload) {
      return null;
    }

    if (operation.type === 'image') {
      const payload = operation.payload;
      const width = Math.max(1, Number(payload.width) || 1);
      const height = Math.max(1, Number(payload.height) || 1);
      const scale = clamp(Number(payload.scale) || 1, 0.1, 8);

      if (payload.coordinateSpace === 'relative') {
        const baseWidth = Math.max(1, Number(payload.baseWidth) || canvas.width);
        const baseHeight = Math.max(1, Number(payload.baseHeight) || canvas.height);
        const anchor = fromRelativePoint({ x: payload.x, y: payload.y }, canvas.width, canvas.height);
        if (!anchor) {
          return null;
        }
        const renderedScale = scale * Math.min(canvas.width / baseWidth, canvas.height / baseHeight);
        return {
          x: anchor.x,
          y: anchor.y,
          w: width * renderedScale,
          h: height * renderedScale,
        };
      }

      return {
        x: Number(payload.x) || 0,
        y: Number(payload.y) || 0,
        w: width * scale,
        h: height * scale,
      };
    }

    if (operation.type === 'stroke' || (operation.type === 'shape' && operation.payload.shape === 'arrow')) {
      const points = operation.type === 'stroke'
        ? resolveOperationPoints(operation.payload, canvas.width, canvas.height)
        : resolveOperationPoints({
          coordinateSpace: operation.payload.coordinateSpace,
          points: operation.payload.points,
        }, canvas.width, canvas.height);

      if (!points.length) {
        return null;
      }

      let minX = points[0].x;
      let maxX = points[0].x;
      let minY = points[0].y;
      let maxY = points[0].y;
      points.forEach((point) => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      });
      return {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
      };
    }

    if (operation.type === 'shape') {
      let x = Number(operation.payload.x) || 0;
      let y = Number(operation.payload.y) || 0;
      let width = Number(operation.payload.width) || 0;
      let height = Number(operation.payload.height) || 0;
      if (operation.payload.coordinateSpace === 'relative') {
        x *= canvas.width;
        y *= canvas.height;
        width *= canvas.width;
        height *= canvas.height;
      }
      const minX = Math.min(x, x + width);
      const minY = Math.min(y, y + height);
      return {
        x: minX,
        y: minY,
        w: Math.max(1, Math.abs(width)),
        h: Math.max(1, Math.abs(height)),
      };
    }

    if (operation.type === 'text') {
      let x = Number(operation.payload.x) || 0;
      let y = Number(operation.payload.y) || 0;
      if (operation.payload.coordinateSpace === 'relative') {
        x *= canvas.width;
        y *= canvas.height;
      }
      const fontSize = clamp(Number(operation.payload.fontSize) || 18, 10, 96);
      const text = String(operation.payload.text || '');
      context.save();
      context.font = `600 ${fontSize}px "Segoe UI", "Microsoft YaHei", sans-serif`;
      const textWidth = Math.max(24, context.measureText(text).width);
      context.restore();
      return {
        x,
        y: y - fontSize,
        w: textWidth,
        h: fontSize * 1.35,
      };
    }

    return null;
  }

  function getHandlePositions(bounds) {
    const pad = 4;
    const x1 = bounds.x - pad;
    const y1 = bounds.y - pad;
    const x2 = bounds.x + bounds.w + pad;
    const y2 = bounds.y + bounds.h + pad;
    return {
      nw: { x: x1, y: y1, cursor: 'nwse-resize' },
      ne: { x: x2, y: y1, cursor: 'nesw-resize' },
      sw: { x: x1, y: y2, cursor: 'nesw-resize' },
      se: { x: x2, y: y2, cursor: 'nwse-resize' },
    };
  }

  function hitTestHandle(point, bounds) {
    if (!bounds) {
      return null;
    }
    const handles = getHandlePositions(bounds);
    const hitSize = 12;
    const names = Object.keys(handles);
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      const handle = handles[name];
      if (Math.abs(point.x - handle.x) <= hitSize && Math.abs(point.y - handle.y) <= hitSize) {
        return name;
      }
    }
    return null;
  }

  function paintSelectionOutline() {
    if (!selectedOperationId) {
      return;
    }

    const operation = state.boardOperations.find((item) => item.id === selectedOperationId);
    if (!operation) {
      return;
    }

    const bounds = getOperationBounds(operation);
    if (!bounds) {
      return;
    }

    context.save();
    context.strokeStyle = '#4f46e5';
    context.lineWidth = 1.5;
    context.setLineDash([5, 4]);
    context.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);
    context.setLineDash([]);
    const handles = getHandlePositions(bounds);
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#4f46e5';
    context.lineWidth = 1.5;
    Object.values(handles).forEach((handle) => {
      context.beginPath();
      context.rect(handle.x - 4, handle.y - 4, 8, 8);
      context.fill();
      context.stroke();
    });
    context.restore();
  }

  function moveOperationBy(operation, dx, dy) {
    if (!operation?.payload || (!dx && !dy)) {
      return;
    }

    const payload = operation.payload;
    const relDx = dx / Math.max(1, canvas.width);
    const relDy = dy / Math.max(1, canvas.height);

    if (operation.type === 'stroke' || (operation.type === 'shape' && payload.shape === 'arrow')) {
      if (!Array.isArray(payload.points)) {
        return;
      }
      payload.points = payload.points.map((point) => {
        if (payload.coordinateSpace === 'relative') {
          return {
            x: clamp(Number(point.x) + relDx, 0, 1),
            y: clamp(Number(point.y) + relDy, 0, 1),
          };
        }
        return {
          x: Number(point.x) + dx,
          y: Number(point.y) + dy,
        };
      });
      return;
    }

    if (payload.coordinateSpace === 'relative') {
      payload.x = clamp(Number(payload.x) + relDx, -0.2, 1.2);
      payload.y = clamp(Number(payload.y) + relDy, -0.2, 1.2);
      return;
    }

    payload.x = Number(payload.x) + dx;
    payload.y = Number(payload.y) + dy;
  }

  function computeResizedBounds(startBounds, handle, point) {
    let x = startBounds.x;
    let y = startBounds.y;
    let w = startBounds.w;
    let h = startBounds.h;
    const right = startBounds.x + startBounds.w;
    const bottom = startBounds.y + startBounds.h;
    const minSize = 12;

    if (handle === 'se') {
      w = Math.max(minSize, point.x - x);
      h = Math.max(minSize, point.y - y);
    } else if (handle === 'sw') {
      const nextX = Math.min(point.x, right - minSize);
      w = right - nextX;
      h = Math.max(minSize, point.y - y);
      x = nextX;
    } else if (handle === 'ne') {
      const nextY = Math.min(point.y, bottom - minSize);
      w = Math.max(minSize, point.x - x);
      h = bottom - nextY;
      y = nextY;
    } else if (handle === 'nw') {
      const nextX = Math.min(point.x, right - minSize);
      const nextY = Math.min(point.y, bottom - minSize);
      w = right - nextX;
      h = bottom - nextY;
      x = nextX;
      y = nextY;
    }

    return { x, y, w, h };
  }

  function scaleOperationFromBounds(operation, fromBounds, toBounds) {
    if (!operation?.payload || !fromBounds || !toBounds) {
      return;
    }

    const sx = toBounds.w / Math.max(1, fromBounds.w);
    const sy = toBounds.h / Math.max(1, fromBounds.h);
    const mapX = (value) => toBounds.x + (value - fromBounds.x) * sx;
    const mapY = (value) => toBounds.y + (value - fromBounds.y) * sy;
    const payload = operation.payload;

    if (operation.type === 'stroke' || (operation.type === 'shape' && payload.shape === 'arrow')) {
      const absolutePoints = operation.type === 'stroke'
        ? resolveOperationPoints(payload, canvas.width, canvas.height)
        : resolveOperationPoints({
          coordinateSpace: payload.coordinateSpace,
          points: payload.points,
        }, canvas.width, canvas.height);

      const mapped = absolutePoints.map((point) => ({
        x: mapX(point.x),
        y: mapY(point.y),
      }));

      if (payload.coordinateSpace === 'relative') {
        payload.points = mapped.map((point) => toRelativePoint(point, canvas.width, canvas.height));
      } else {
        payload.points = mapped;
      }

      if (payload.size != null) {
        payload.size = clamp(Number(payload.size) * Math.sqrt(Math.abs(sx * sy)), 1, 48);
      }
      return;
    }

    if (operation.type === 'image') {
      const width = Math.max(1, Number(payload.width) || 1);
      const height = Math.max(1, Number(payload.height) || 1);
      // Keep aspect by using the smaller scale so content fits the box.
      const nextScale = clamp(Math.min(toBounds.w / width, toBounds.h / height), 0.05, 8);

      if (payload.coordinateSpace === 'relative') {
        payload.x = toBounds.x / Math.max(1, canvas.width);
        payload.y = toBounds.y / Math.max(1, canvas.height);
        payload.baseWidth = canvas.width;
        payload.baseHeight = canvas.height;
        payload.scale = nextScale;
      } else {
        payload.x = toBounds.x;
        payload.y = toBounds.y;
        payload.scale = nextScale;
      }
      return;
    }

    if (operation.type === 'shape') {
      if (payload.coordinateSpace === 'relative') {
        payload.x = toBounds.x / Math.max(1, canvas.width);
        payload.y = toBounds.y / Math.max(1, canvas.height);
        payload.width = toBounds.w / Math.max(1, canvas.width);
        payload.height = toBounds.h / Math.max(1, canvas.height);
      } else {
        payload.x = toBounds.x;
        payload.y = toBounds.y;
        payload.width = toBounds.w;
        payload.height = toBounds.h;
      }
      if (payload.size != null) {
        payload.size = clamp(Number(payload.size) * Math.sqrt(Math.abs(sx * sy)), 1, 48);
      }
      return;
    }

    if (operation.type === 'text') {
      const nextFontSize = clamp(toBounds.h / 1.35, 10, 200);
      if (payload.coordinateSpace === 'relative') {
        payload.x = toBounds.x / Math.max(1, canvas.width);
        payload.y = (toBounds.y + nextFontSize) / Math.max(1, canvas.height);
      } else {
        payload.x = toBounds.x;
        payload.y = toBounds.y + nextFontSize;
      }
      payload.fontSize = nextFontSize;
    }
  }

  function applyResizeFromDrag(point) {
    if (!selectionDrag || selectionDrag.mode !== 'resize') {
      return;
    }

    const operation = state.boardOperations.find((item) => item.id === selectionDrag.operationId);
    if (!operation || !selectionDrag.originalPayload || !selectionDrag.startBounds) {
      return;
    }

    // Always rebuild from the snapshot taken at resize start to avoid cumulative error.
    operation.payload = JSON.parse(JSON.stringify(selectionDrag.originalPayload));
    const nextBounds = computeResizedBounds(selectionDrag.startBounds, selectionDrag.handle, point);
    scaleOperationFromBounds(operation, selectionDrag.startBounds, nextBounds);
    selectionDrag.moved = true;
  }

  function commitMovedSelection() {
    if (!selectionDrag?.moved || !selectionDrag.operationId) {
      return;
    }

    const operation = state.boardOperations.find((item) => item.id === selectionDrag.operationId);
    if (!operation) {
      return;
    }

    // Sync to room: replace operation so other clients get the new geometry.
    const movedCopy = JSON.parse(JSON.stringify(operation));
    movedCopy.id = createOperationId();
    movedCopy.createdAt = new Date().toISOString();

    removeOperation(operation.id, {
      pushRedo: false,
      emit: true,
      skipRedraw: true,
    });

    appendOperation(movedCopy, {
      trackUndo: true,
      emit: true,
      skipRender: true,
    });

    selectedOperationId = movedCopy.id;
    redrawFromOperations();
  }

  async function refreshStrokeSnapshotFromOperations() {
    if (!state.isDrawing) {
      return;
    }

    if (strokeSnapshotRefreshPromise) {
      await strokeSnapshotRefreshPromise;
      return;
    }

    strokeSnapshotRefreshPromise = redrawFromOperations({ preserveStrokePreview: true })
      .finally(() => {
        strokeSnapshotRefreshPromise = null;
      });

    await strokeSnapshotRefreshPromise;
  }

  function pruneUndoStack(operationId) {
    state.undoStack = state.undoStack.filter((id) => id !== operationId);
  }

  function pruneRedoStack(operationId) {
    state.redoStack = state.redoStack.filter((operation) => operation.id !== operationId);
  }

  function appendOperation(operation, options = {}) {
    const { trackUndo = false, clearRedo = true, emit = false, skipRender = false } = options;

    if (!operation?.id || state.boardOperations.some((item) => item.id === operation.id)) {
      return false;
    }

    state.boardOperations.push(operation);
    if (state.boardOperations.length > 2000) {
      const [removed] = state.boardOperations.splice(0, state.boardOperations.length - 2000);
      if (removed) {
        pruneUndoStack(removed.id);
        pruneRedoStack(removed.id);
      }
    }

    if (trackUndo) {
      state.undoStack.push(operation.id);
      if (clearRedo) {
        state.redoStack = [];
      }
    }

    if (!skipRender) {
      if (operation.type === 'stroke') {
        renderStrokeOperation(operation);
      } else if (operation.type === 'shape') {
        renderShapeOperation(operation);
      } else if (operation.type === 'text') {
        renderTextOperation(operation);
      } else {
        redrawFromOperations();
      }
    }

    if (emit) {
      onAddOperation(operation);
    }

    return true;
  }

  function removeOperation(operationId, options = {}) {
    const { pushRedo = false, emit = false, skipRedraw = false } = options;
    const index = state.boardOperations.findIndex((operation) => operation.id === operationId);

    if (index < 0) {
      return false;
    }

    const [removedOperation] = state.boardOperations.splice(index, 1);

    if (pushRedo && removedOperation) {
      state.redoStack.push(removedOperation);
      if (state.redoStack.length > 100) {
        state.redoStack = state.redoStack.slice(-100);
      }
    }

    pruneUndoStack(operationId);

    if (!skipRedraw) {
      clearStrokeSnapshot();
      redrawFromOperations({ preserveStrokePreview: state.isDrawing });
    }

    if (emit) {
      onRemoveOperation(operationId);
    }

    return true;
  }

  function hitTestOperation(point) {
    // Prefer latest ops for select/move.
    for (let index = state.boardOperations.length - 1; index >= 0; index -= 1) {
      const operation = state.boardOperations[index];

      if (operation.type === 'image') {
        const bounds = getOperationBounds(operation);
        if (!bounds) {
          continue;
        }
        if (
          point.x >= bounds.x - 4
          && point.x <= bounds.x + bounds.w + 4
          && point.y >= bounds.y - 4
          && point.y <= bounds.y + bounds.h + 4
        ) {
          return operation;
        }
        continue;
      }

      if (operation.type === 'stroke') {
        const points = resolveOperationPoints(operation.payload, canvas.width, canvas.height);
        if (points.some((item) => distanceBetweenPoints(item, point) <= 14)) {
          return operation;
        }
      } else if (operation.type === 'shape' && operation.payload?.shape === 'arrow') {
        const points = resolveOperationPoints({
          coordinateSpace: operation.payload.coordinateSpace,
          points: operation.payload.points,
        }, canvas.width, canvas.height);
        if (points.some((item) => distanceBetweenPoints(item, point) <= 14)) {
          return operation;
        }
      } else if (operation.type === 'shape') {
        const bounds = getOperationBounds(operation);
        if (
          bounds
          && point.x >= bounds.x - 6
          && point.x <= bounds.x + bounds.w + 6
          && point.y >= bounds.y - 6
          && point.y <= bounds.y + bounds.h + 6
        ) {
          return operation;
        }
      } else if (operation.type === 'text') {
        const bounds = getOperationBounds(operation);
        if (
          bounds
          && point.x >= bounds.x - 6
          && point.x <= bounds.x + bounds.w + 6
          && point.y >= bounds.y - 6
          && point.y <= bounds.y + bounds.h + 6
        ) {
          return operation;
        }
      }
    }
    return null;
  }

  function startDrawing(event) {
    if (activePointerId !== null) {
      return;
    }

    event.preventDefault();
    activePointerId = event.pointerId;

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (_error) {
    }

    const point = getPointFromEvent(event);

    if (state.currentTool === 'select') {
      // Prefer resizing from corner handles of the currently selected object.
      if (selectedOperationId) {
        const selected = state.boardOperations.find((item) => item.id === selectedOperationId);
        const bounds = selected ? getOperationBounds(selected) : null;
        const handle = hitTestHandle(point, bounds);
        if (handle && selected && bounds) {
          selectionDrag = {
            mode: 'resize',
            handle,
            operationId: selected.id,
            startBounds: { ...bounds },
            originalPayload: JSON.parse(JSON.stringify(selected.payload)),
            lastX: point.x,
            lastY: point.y,
            moved: false,
          };
          state.isDrawing = true;
          canvas.style.cursor = getHandlePositions(bounds)[handle]?.cursor || 'nwse-resize';
          redrawFromOperations();
          return;
        }
      }

      const hit = hitTestOperation(point);
      selectedOperationId = hit?.id || null;
      selectionDrag = hit
        ? {
          mode: 'move',
          operationId: hit.id,
          lastX: point.x,
          lastY: point.y,
          moved: false,
        }
        : null;
      state.isDrawing = Boolean(hit);
      canvas.style.cursor = hit ? 'grabbing' : 'default';
      redrawFromOperations();
      return;
    }

    selectedOperationId = null;
    selectionDrag = null;

    if (state.currentTool === 'text') {
      const text = window.prompt('输入标注文字', '');
      activePointerId = null;
      if (!text || !text.trim()) {
        return;
      }
      const relative = toRelativePoint(point, canvas.width, canvas.height);
      appendOperation({
        id: createOperationId(),
        type: 'text',
        roomId: state.currentRoomId,
        username: state.currentUser,
        deviceType: state.currentDeviceType,
        createdAt: new Date().toISOString(),
        payload: {
          text: text.trim().slice(0, 200),
          color: state.currentColor,
          fontSize: Math.max(14, state.currentSize * 4),
          coordinateSpace: 'relative',
          x: relative.x,
          y: relative.y,
        },
      }, { trackUndo: true, emit: true });
      return;
    }

    state.isDrawing = true;
    state.currentX = point.x;
    state.currentY = point.y;
    currentStrokePoints = [point];
    currentStrokeStyle = {
      tool: state.currentTool,
      color: state.currentColor,
      size: state.currentSize,
    };
    // Snapshot committed board so live stroke previews stay O(1) per move.
    captureStrokeSnapshot();
  }


  function draw(event) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    // Selection drag: move or resize selected object (including images).
    if (state.currentTool === 'select' && selectionDrag) {
      event.preventDefault();
      const point = getPointFromEvent(event);

      if (selectionDrag.mode === 'resize') {
        applyResizeFromDrag(point);
        redrawFromOperations();
        return;
      }

      const dx = point.x - selectionDrag.lastX;
      const dy = point.y - selectionDrag.lastY;
      if (Math.hypot(dx, dy) < 0.5) {
        return;
      }

      const operation = state.boardOperations.find((item) => item.id === selectionDrag.operationId);
      if (!operation) {
        return;
      }

      moveOperationBy(operation, dx, dy);
      selectionDrag.lastX = point.x;
      selectionDrag.lastY = point.y;
      selectionDrag.moved = true;
      redrawFromOperations();
      return;
    }

    if (!state.isDrawing || !currentStrokeStyle) {
      return;
    }

    event.preventDefault();
    const point = getPointFromEvent(event);
    const tool = currentStrokeStyle.tool;

    if (['rect', 'ellipse', 'arrow'].includes(tool)) {
      currentStrokePoints = [currentStrokePoints[0], point];
      state.currentX = point.x;
      state.currentY = point.y;
      if (!restoreStrokeSnapshot()) {
        refreshStrokeSnapshotFromOperations();
        return;
      }
      const start = currentStrokePoints[0];
      if (tool === 'arrow') {
        renderShapeOperation({
          payload: {
            shape: 'arrow',
            color: currentStrokeStyle.color,
            size: currentStrokeStyle.size,
            points: [start, point],
          },
        });
      } else {
        renderShapeOperation({
          payload: {
            shape: tool,
            color: currentStrokeStyle.color,
            size: currentStrokeStyle.size,
            x: start.x,
            y: start.y,
            width: point.x - start.x,
            height: point.y - start.y,
          },
        });
      }
      return;
    }

    const previousPoint = currentStrokePoints[currentStrokePoints.length - 1];

    if (distanceBetweenPoints(previousPoint, point) < POINTER_MOVE_MIN_DISTANCE) {
      return;
    }

    currentStrokePoints.push(point);
    state.currentX = point.x;
    state.currentY = point.y;

    if (!restoreStrokeSnapshot()) {
      // Snapshot missing/out-of-date: rebuild once, then keep painting previews.
      refreshStrokeSnapshotFromOperations();
      return;
    }

    paintCurrentStrokePreview();
  }

  function stopDrawing(event) {
    if (event && activePointerId !== null && event.pointerId !== activePointerId) {
      return;
    }

    if (event) {
      event.preventDefault();
      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    }

    // Finish selection drag without deleting.
    if (state.currentTool === 'select' || selectionDrag) {
      if (selectionDrag?.moved) {
        commitMovedSelection();
      } else {
        redrawFromOperations();
      }
      selectionDrag = null;
      activePointerId = null;
      state.isDrawing = false;
      canvas.style.cursor = state.currentTool === 'select' ? 'default' : '';
      return;
    }

    if (!state.isDrawing) {
      activePointerId = null;
      return;
    }

    activePointerId = null;
    state.isDrawing = false;

    const tool = currentStrokeStyle?.tool;

    if (['rect', 'ellipse', 'arrow'].includes(tool) && currentStrokePoints.length >= 2) {
      const start = currentStrokePoints[0];
      const end = currentStrokePoints[currentStrokePoints.length - 1];
      restoreStrokeSnapshot();
      clearStrokeSnapshot();

      if (tool === 'arrow') {
        appendOperation({
          id: createOperationId(),
          type: 'shape',
          roomId: state.currentRoomId,
          username: state.currentUser,
          deviceType: state.currentDeviceType,
          createdAt: new Date().toISOString(),
          payload: {
            shape: 'arrow',
            color: currentStrokeStyle.color,
            size: currentStrokeStyle.size,
            coordinateSpace: 'relative',
            points: [
              toRelativePoint(start, canvas.width, canvas.height),
              toRelativePoint(end, canvas.width, canvas.height),
            ],
          },
        }, { trackUndo: true, emit: true });
      } else {
        const relStart = toRelativePoint(start, canvas.width, canvas.height);
        const relEnd = toRelativePoint(end, canvas.width, canvas.height);
        appendOperation({
          id: createOperationId(),
          type: 'shape',
          roomId: state.currentRoomId,
          username: state.currentUser,
          deviceType: state.currentDeviceType,
          createdAt: new Date().toISOString(),
          payload: {
            shape: tool,
            color: currentStrokeStyle.color,
            size: currentStrokeStyle.size,
            coordinateSpace: 'relative',
            x: relStart.x,
            y: relStart.y,
            width: relEnd.x - relStart.x,
            height: relEnd.y - relStart.y,
          },
        }, { trackUndo: true, emit: true });
      }

      currentStrokePoints = [];
      currentStrokeStyle = null;
      return;
    }

    if (!currentStrokeStyle || currentStrokePoints.length < 2 || !['brush', 'eraser'].includes(tool)) {
      currentStrokePoints = [];
      currentStrokeStyle = null;
      clearStrokeSnapshot();
      redrawFromOperations();
      return;
    }

    const points = buildSmoothedPoints(currentStrokePoints, currentStrokeStyle.size);

    if (points.length < 2) {
      currentStrokePoints = [];
      currentStrokeStyle = null;
      clearStrokeSnapshot();
      redrawFromOperations();
      return;
    }

    const operation = {
      id: createOperationId(),
      type: 'stroke',
      roomId: state.currentRoomId,
      username: state.currentUser,
      deviceType: state.currentDeviceType,
      createdAt: new Date().toISOString(),
      payload: {
        tool: currentStrokeStyle.tool,
        color: currentStrokeStyle.color,
        size: currentStrokeStyle.size,
        coordinateSpace: 'relative',
        points: points.map((point) => toRelativePoint(point, canvas.width, canvas.height)),
      },
    };

    // Restore committed board before final stroke render to avoid double-paint.
    restoreStrokeSnapshot();
    clearStrokeSnapshot();

    appendOperation(operation, {
      trackUndo: true,
      emit: true,
      skipRender: false,
    });

    currentStrokePoints = [];
    currentStrokeStyle = null;
  }

  async function annotateWithScreenshot(file) {
    if (!file) {
      return;
    }
    try {
      const uploadResult = await onUploadImage(file);
      if (!uploadResult?.imageUrl) {
        throw new Error('no url');
      }
      const dimensions = await resolveImageDimensions(uploadResult.imageUrl);
      const scale = Math.min(
        (canvas.width * 0.92) / dimensions.width,
        (canvas.height * 0.92) / dimensions.height,
        1,
      );
      appendOperation({
        id: createOperationId(),
        type: 'image',
        roomId: state.currentRoomId,
        username: state.currentUser,
        deviceType: state.currentDeviceType,
        createdAt: new Date().toISOString(),
        payload: {
          imageUrl: uploadResult.imageUrl,
          coordinateSpace: 'relative',
          x: 0.04,
          y: 0.04,
          baseWidth: canvas.width,
          baseHeight: canvas.height,
          width: dimensions.width,
          height: dimensions.height,
          scale: Number(scale.toFixed(3)),
        },
      }, { trackUndo: true, emit: true });
      state.currentTool = 'brush';
      syncControls();
    } catch (_error) {
      onError('标注截图失败', '请重试图片上传');
    }
  }

  function syncCanvasSize() {
    const container = canvas.parentElement;

    if (!container) {
      return false;
    }

    const nextWidth = Math.max(1, Math.floor(container.clientWidth));
    const nextHeight = Math.max(1, Math.floor(container.clientHeight));

    if (nextWidth === lastCanvasWidth && nextHeight === lastCanvasHeight) {
      return false;
    }

    lastCanvasWidth = nextWidth;
    lastCanvasHeight = nextHeight;
    canvas.width = nextWidth;
    canvas.height = nextHeight;

    return true;
  }

  function resizeCanvas() {
    const changed = syncCanvasSize();

    if (changed) {
      clearStrokeSnapshot();
      redrawFromOperations({ preserveStrokePreview: state.isDrawing });
    }
  }

  function scheduleResizeSync() {
    if (resizeFrame) {
      return;
    }

    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      resizeCanvas();
    });
  }

  function observeCanvasContainerResize() {
    const container = canvas.parentElement;

    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    resizeObserver = new ResizeObserver(() => {
      scheduleResizeSync();
    });

    resizeObserver.observe(container);
  }

  function clearCanvas(emit = false) {
    state.boardOperations = [];
    state.undoStack = [];
    state.redoStack = [];
    clearStrokeSnapshot();
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (state.isDrawing) {
      captureStrokeSnapshot();
      paintCurrentStrokePreview();
    }

    if (emit) {
      onClear();
    }
  }

  function applyRoomOperations(operations) {
    state.boardOperations = Array.isArray(operations) ? [...operations] : [];
    state.undoStack = [];
    state.redoStack = [];
    clearStrokeSnapshot();
    redrawFromOperations({ preserveStrokePreview: state.isDrawing });
  }

  function appendRemoteOperation(operation) {
    const added = appendOperation(operation, {
      trackUndo: false,
      clearRedo: false,
      emit: false,
      skipRender: state.isDrawing,
    });

    if (!added) {
      return;
    }

    if (state.isDrawing) {
      // Keep live preview correct when collaborators draw at the same time.
      refreshStrokeSnapshotFromOperations();
    }
  }

  function removeRemoteOperation(operationId) {
    const removed = removeOperation(operationId, {
      pushRedo: false,
      emit: false,
      skipRedraw: state.isDrawing,
    });

    if (!removed) {
      return;
    }

    if (state.isDrawing) {
      refreshStrokeSnapshotFromOperations();
    }
  }

  function undoLastLocalOperation() {
    while (state.undoStack.length) {
      const operationId = state.undoStack.pop();
      const removed = removeOperation(operationId, {
        pushRedo: true,
        emit: true,
      });

      if (removed) {
        return;
      }
    }
  }

  function redoLastLocalOperation() {
    const operation = state.redoStack.pop();

    if (!operation) {
      return;
    }

    appendOperation(operation, {
      trackUndo: true,
      clearRedo: false,
      emit: true,
      skipRender: false,
    });
  }

  function exportAsPng() {
    const downloadUrl = canvas.toDataURL('image/png');
    const anchor = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
    anchor.href = downloadUrl;
    anchor.download = `syncboard-${state.currentRoomId}-${timestamp}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function setDropHighlight(active) {
    canvas.classList.toggle('board-drop-active', active);
  }

  function resolveImageDimensions(imageUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        resolve({
          width: image.naturalWidth || 1,
          height: image.naturalHeight || 1,
        });
      };
      image.onerror = () => reject(new Error('无法读取图片尺寸'));
      image.src = imageUrl;
    });
  }

  async function handleDrop(event) {
    event.preventDefault();
    setDropHighlight(false);

    const files = Array.from(event.dataTransfer?.files || []);
    const imageFile = files.find((file) => String(file.type || '').startsWith('image/'));

    if (!imageFile) {
      return;
    }

    const point = getPointFromEvent(event);

    try {
      const uploadResult = await onUploadImage(imageFile);

      if (!uploadResult?.imageUrl) {
        throw new Error('未获取到图片地址');
      }

      const dimensions = await resolveImageDimensions(uploadResult.imageUrl);
      const defaultScale = Math.min(1, (canvas.width * 0.55) / dimensions.width);

      const operation = {
        id: createOperationId(),
        type: 'image',
        roomId: state.currentRoomId,
        username: state.currentUser,
        deviceType: state.currentDeviceType,
        createdAt: new Date().toISOString(),
        payload: {
          imageUrl: uploadResult.imageUrl,
          coordinateSpace: 'relative',
          x: toRelativePoint(point, canvas.width, canvas.height).x,
          y: toRelativePoint(point, canvas.width, canvas.height).y,
          baseWidth: canvas.width,
          baseHeight: canvas.height,
          width: dimensions.width,
          height: dimensions.height,
          scale: Number(defaultScale.toFixed(3)),
        },
      };

      appendOperation(operation, {
        trackUndo: true,
        emit: true,
      });
    } catch (_error) {
      onError('图片上传失败', '请稍后重试或检查图片格式');
    }
  }

  function bindControlEvents() {
    colorPickers.forEach((picker) => {
      picker.addEventListener('input', (event) => {
        state.currentColor = event.target.value;
        syncControls();
      });
    });

    swatches.forEach((swatch) => {
      swatch.style.backgroundColor = swatch.dataset.colorSwatch || '#f59e0b';
      swatch.addEventListener('click', () => {
        const nextColor = String(swatch.dataset.colorSwatch || '').trim();

        if (!nextColor) {
          return;
        }

        state.currentColor = nextColor;
        syncControls();
      });
    });

    brushSizeInputs.forEach((input) => {
      input.addEventListener('input', (event) => {
        state.currentSize = clamp(Number(event.target.value), 1, 24);
        syncControls();
      });
    });

    const setTool = (tool) => {
      state.currentTool = tool;
      if (tool !== 'select') {
        selectedOperationId = null;
        selectionDrag = null;
        canvas.style.cursor = '';
        redrawFromOperations();
      }
      syncControls();
    };

    brushButtons.forEach((button) => {
      button.addEventListener('click', () => setTool('brush'));
    });

    eraserButtons.forEach((button) => {
      button.addEventListener('click', () => setTool('eraser'));
    });

    shapeRectButtons.forEach((button) => {
      button.addEventListener('click', () => setTool('rect'));
    });
    shapeEllipseButtons.forEach((button) => {
      button.addEventListener('click', () => setTool('ellipse'));
    });
    shapeArrowButtons.forEach((button) => {
      button.addEventListener('click', () => setTool('arrow'));
    });
    textButtons.forEach((button) => {
      button.addEventListener('click', () => setTool('text'));
    });
    selectButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.currentTool = 'select';
        canvas.style.cursor = 'default';
        syncControls();
      });
    });

    window.addEventListener('keydown', (event) => {
      if (state.currentTool !== 'select' || !selectedOperationId) {
        return;
      }

      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeOperation(selectedOperationId, {
          pushRedo: true,
          emit: true,
        });
        selectedOperationId = null;
        selectionDrag = null;
      }

      if (event.key === 'Escape') {
        selectedOperationId = null;
        selectionDrag = null;
        redrawFromOperations();
      }
    });
    annotateButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (annotateInput) {
          annotateInput.click();
        }
      });
    });
    if (annotateInput) {
      annotateInput.addEventListener('change', () => {
        const [file] = Array.from(annotateInput.files || []);
        annotateInput.value = '';
        if (file) {
          annotateWithScreenshot(file);
        }
      });
    }

    clearButtons.forEach((button) => {
      button.addEventListener('click', () => clearCanvas(true));
    });

    undoButtons.forEach((button) => {
      button.addEventListener('click', undoLastLocalOperation);
    });

    redoButtons.forEach((button) => {
      button.addEventListener('click', redoLastLocalOperation);
    });
  }

  function init() {
    syncControls();
    bindControlEvents();

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', (event) => {
      // Hover cursor over resize handles when select tool is active.
      if (state.currentTool === 'select' && !selectionDrag && selectedOperationId && event.buttons === 0) {
        const point = getPointFromEvent(event);
        const selected = state.boardOperations.find((item) => item.id === selectedOperationId);
        const bounds = selected ? getOperationBounds(selected) : null;
        const handle = hitTestHandle(point, bounds);
        if (handle && bounds) {
          canvas.style.cursor = getHandlePositions(bounds)[handle]?.cursor || 'nwse-resize';
        } else if (hitTestOperation(point)) {
          canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = 'default';
        }
      }
      draw(event);
    });
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    canvas.addEventListener('pointerleave', (event) => {
      if (event.pointerId === activePointerId && !canvas.hasPointerCapture(event.pointerId)) {
        stopDrawing(event);
      }
    });

    canvas.addEventListener('dragover', (event) => {
      event.preventDefault();
      setDropHighlight(true);
    });

    canvas.addEventListener('dragleave', () => {
      setDropHighlight(false);
    });

    canvas.addEventListener('drop', handleDrop);

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('syncboard:layout-changed', scheduleResizeSync);
    observeCanvasContainerResize();
    resizeCanvas();
  }

  return {
    appendRemoteOperation,
    applyRoomOperations,
    clearCanvas,
    exportAsPng,
    init,
    redoLastLocalOperation,
    removeRemoteOperation,
    resizeCanvas,
    undoLastLocalOperation,
  };
}

export { createWhiteboardModule };

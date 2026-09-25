const MAGIC = 0x4f50;
export const OPTIFRAME_SIZE = 128;
export const OPTIFRAME_MAX_PAYLOAD = 3900;
const HEADER_BITS = 64;
const HEADER_VERSION = 1;
const FINDER_SIZE = 9;
const FINDER_OFFSET = 4;
const LUMINANCE_LEVELS = [0, 85, 170, 255] as const;

export type OptiFrame = {
  version: number;
  sequence: number;
  total: number;
  payload: Uint8Array;
};

export type OptiFrameAnchor = {
  x: number;
  y: number;
  score: number;
  scale: number;
  angle: number;
};

export type OptiFramePerspectiveDiagnostics = {
  anchors: [OptiFrameAnchor, OptiFrameAnchor, OptiFrameAnchor, OptiFrameAnchor];
  confidence: number;
  sampleWidth: number;
  sampleHeight: number;
  decodeMs: number;
};

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeBits(out: number[], value: number, count: number) {
  for (let b = count - 1; b >= 0; b--) out.push((value >>> b) & 1);
}

function readBits(bits: number[], offset: number, count: number) {
  let value = 0;
  for (let i = 0; i < count; i++) value = (value << 1) | bits[offset + i];
  return value >>> 0;
}

function bytesToBits(bytes: Uint8Array) {
  const out: number[] = [];
  for (const byte of bytes) writeBits(out, byte, 8);
  return out;
}

function bitsToBytes(bits: number[]) {
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) out[i] = readBits(bits, i * 8, 8);
  return out;
}

function finderBit(r: number, c: number) {
  const edge = r === 0 || c === 0 || r === FINDER_SIZE - 1 || c === FINDER_SIZE - 1;
  const ring = r === 1 || c === 1 || r === 7 || c === 7;
  const center = r >= 2 && r <= 6 && c >= 2 && c <= 6;
  return edge || (center && !ring);
}

function zones() {
  return [
    [FINDER_OFFSET, FINDER_OFFSET],
    [OPTIFRAME_SIZE - FINDER_OFFSET - FINDER_SIZE, FINDER_OFFSET],
    [FINDER_OFFSET, OPTIFRAME_SIZE - FINDER_OFFSET - FINDER_SIZE],
    [OPTIFRAME_SIZE - FINDER_OFFSET - FINDER_SIZE, OPTIFRAME_SIZE - FINDER_OFFSET - FINDER_SIZE],
  ] as const;
}

function isFinderCell(r: number, c: number) {
  return zones().some(([y, x]) => r >= y && r < y + FINDER_SIZE && c >= x && c < x + FINDER_SIZE);
}

function finderValue(r: number, c: number) {
  for (const [y, x] of zones()) {
    if (r >= y && r < y + FINDER_SIZE && c >= x && c < x + FINDER_SIZE) {
      return finderBit(r - y, c - x) ? 3 : 0;
    }
  }
  return -1;
}

function capacityBits() {
  let n = 0;
  for (let r = 0; r < OPTIFRAME_SIZE; r++) {
    for (let c = 0; c < OPTIFRAME_SIZE; c++) {
      if (!isFinderCell(r, c)) n += 2;
    }
  }
  return n - HEADER_BITS;
}

export function getOptiFrameCapacity() {
  return Math.min(OPTIFRAME_MAX_PAYLOAD, Math.floor(capacityBits() / 8) - 4);
}

export function encodeOptiFrame(payload: Uint8Array, sequence = 0, total = 1) {
  const capacity = getOptiFrameCapacity();
  if (payload.length > capacity) throw new Error('OptiFrame payload is too large.');
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 65535 || !Number.isInteger(total) || total < 1 || total > 65535) {
    throw new Error('OptiFrame metadata is out of range.');
  }

  const header: number[] = [];
  writeBits(header, MAGIC, 16);
  writeBits(header, HEADER_VERSION, 4);
  writeBits(header, sequence, 16);
  writeBits(header, total, 16);
  writeBits(header, payload.length, 12);

  const body = new Uint8Array(payload.length + 4);
  body.set(payload);
  const crc = crc32(payload);
  body[payload.length] = crc >>> 24;
  body[payload.length + 1] = crc >>> 16;
  body[payload.length + 2] = crc >>> 8;
  body[payload.length + 3] = crc;

  const bits = [...header, ...bytesToBits(body)];
  const canvas = document.createElement('canvas');
  canvas.width = OPTIFRAME_SIZE;
  canvas.height = OPTIFRAME_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');

  const image = ctx.createImageData(OPTIFRAME_SIZE, OPTIFRAME_SIZE);
  let cursor = 0;
  for (let r = 0; r < OPTIFRAME_SIZE; r++) {
    for (let col = 0; col < OPTIFRAME_SIZE; col++) {
      const i = (r * OPTIFRAME_SIZE + col) * 4;
      let level = finderValue(r, col);
      if (level < 0) {
        level = ((bits[cursor] ?? 0) << 1) | (bits[cursor + 1] ?? 0);
        cursor += 2;
      }
      const lum = LUMINANCE_LEVELS[level as 0 | 1 | 2 | 3];
      image.data[i] = lum;
      image.data[i + 1] = lum;
      image.data[i + 2] = lum;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return { canvas, frame: { version: HEADER_VERSION, sequence, total, payload } as OptiFrame };
}

function toImageData(source: CanvasImageSource | ImageData) {
  if (source instanceof ImageData) return source;

  const dimensions = source as unknown as { width?: number; height?: number; displayWidth?: number; displayHeight?: number };
  const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : (typeof dimensions.width === 'number' ? dimensions.width : dimensions.displayWidth ?? 0);
  const sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : (typeof dimensions.height === 'number' ? dimensions.height : dimensions.displayHeight ?? 0);
  if (!sourceWidth || !sourceHeight) return null;

  // Preserve the high-resolution camera sample; finder detection needs the real module scale.
  const maxDimension = 1440;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function quantize(v: number) {
  return v < 43 ? 0 : v < 128 ? 1 : v < 213 ? 2 : 3;
}

function decodeAxisAlignedImage(image: ImageData) {
  if (image.width !== OPTIFRAME_SIZE || image.height !== OPTIFRAME_SIZE) return null;
  const bits: number[] = [];
  for (let r = 0; r < OPTIFRAME_SIZE; r++) {
    for (let col = 0; col < OPTIFRAME_SIZE; col++) {
      if (isFinderCell(r, col)) continue;
      const i = (r * OPTIFRAME_SIZE + col) * 4;
      const level = quantize((image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3);
      bits.push((level >>> 1) & 1, level & 1);
    }
  }
  return decodeBits(bits);
}

function decodeBits(bits: number[]) {
  if (bits.length < HEADER_BITS + 32) return null;

  const magic = readBits(bits, 0, 16);
  const version = readBits(bits, 16, 4);
  const sequence = readBits(bits, 20, 16);
  const total = readBits(bits, 36, 16);
  const length = readBits(bits, 52, 12);
  if (magic !== MAGIC || version !== HEADER_VERSION || total < 1 || length > OPTIFRAME_MAX_PAYLOAD) return null;

  const byteBits = bits.slice(HEADER_BITS, HEADER_BITS + (length + 4) * 8);
  if (byteBits.length < (length + 4) * 8) return null;
  const bytes = bitsToBytes(byteBits);
  const payload = bytes.slice(0, length);
  const expected = ((bytes[length] << 24) | (bytes[length + 1] << 16) | (bytes[length + 2] << 8) | bytes[length + 3]) >>> 0;
  if (crc32(payload) !== expected) return null;

  return { version, sequence, total, payload } as OptiFrame;
}

export function decodeOptiFrame(source: CanvasImageSource | ImageData) {
  const canvas = document.createElement('canvas');
  canvas.width = OPTIFRAME_SIZE;
  canvas.height = OPTIFRAME_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  if (source instanceof ImageData) {
    if (source.width !== OPTIFRAME_SIZE || source.height !== OPTIFRAME_SIZE) return null;
    ctx.putImageData(source, 0, 0);
  } else {
    ctx.drawImage(source, 0, 0, OPTIFRAME_SIZE, OPTIFRAME_SIZE);
  }
  return decodeAxisAlignedImage(ctx.getImageData(0, 0, OPTIFRAME_SIZE, OPTIFRAME_SIZE));
}

function bilinear(image: ImageData, x: number, y: number) {
  const { width, height, data } = image;
  const fx = Math.max(0, Math.min(width - 1.001, x));
  const fy = Math.max(0, Math.min(height - 1.001, y));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const dx = fx - x0;
  const dy = fy - y0;
  const sample = (sx: number, sy: number) => {
    const i = (sy * width + sx) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };
  return (
    sample(x0, y0) * (1 - dx) * (1 - dy) +
    sample(x1, y0) * dx * (1 - dy) +
    sample(x0, y1) * (1 - dx) * dy +
    sample(x1, y1) * dx * dy
  );
}

function expectedFinderLuma(r: number, c: number) {
  return finderBit(r, c) ? 1 : 0;
}

function finderScore(image: ImageData, cx: number, cy: number, moduleScale: number, angle = 0) {
  const points: Array<{ value: number; expected: number; weight: number }> = [];
  const half = (FINDER_SIZE - 1) / 2;
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  let min = 255;
  let max = 0;

  for (let r = 0; r < FINDER_SIZE; r++) {
    for (let c = 0; c < FINDER_SIZE; c++) {
      const dx = (c - half) * moduleScale;
      const dy = (r - half) * moduleScale;
      const x = cx + dx * cos - dy * sin;
      const y = cy + dx * sin + dy * cos;
      const value = bilinear(image, x, y);
      min = Math.min(min, value);
      max = Math.max(max, value);
      points.push({ value, expected: expectedFinderLuma(r, c), weight: finderBit(r, c) ? 1.1 : 1.65 });
    }
  }

  if (max - min < 55) return -1;
  let error = 0;
  let weight = 0;
  for (const point of points) {
    const normalized = (point.value - min) / (max - min);
    error += Math.abs(normalized - point.expected) * point.weight;
    weight += point.weight;
  }
  return 1 - error / weight;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

function searchFinder(image: ImageData, corner: Corner) {
  const width = image.width;
  const height = image.height;
  const minDim = Math.min(width, height);
  const step = Math.max(5, Math.round(minDim / 105));
  const expectedScale = minDim / OPTIFRAME_SIZE;
  const minScale = Math.max(1.25, expectedScale * 0.42);
  const maxScale = Math.min(18, Math.max(minScale + 2, expectedScale * 2.25));
  const scaleStep = 1;

  const xStart = corner.includes('l') ? 0 : Math.floor(width * 0.43);
  const xEnd = corner.includes('l') ? Math.floor(width * 0.60) : width;
  const yStart = corner.includes('t') ? 0 : Math.floor(height * 0.43);
  const yEnd = corner.includes('t') ? Math.floor(height * 0.60) : height;

  const scan = (angles: readonly number[]) => {
    let best: OptiFrameAnchor | null = null;
    for (const angle of angles) {
      for (let scale = minScale; scale <= maxScale; scale += scaleStep) {
        for (let y = yStart + 4; y < yEnd - 4; y += step) {
          for (let x = xStart + 4; x < xEnd - 4; x += step) {
            const score = finderScore(image, x, y, scale, angle);
            if (score > (best?.score ?? 0)) best = { x, y, score, scale, angle };
          }
        }
      }
    }
    return best;
  };

  // Most captures are close to upright. Start cheaply at 0° and only pay for
  // rotational hypotheses when the upright search is not convincing.
  let best = scan([0]);
  if (!best || best.score < 0.84) {
    const rotated = scan([-24, -16, -8, 8, 16, 24]);
    if (rotated && rotated.score > (best?.score ?? 0)) best = rotated;
  }

  if (!best || best.score < 0.68) return null;

  let refined = best;
  const fineStep = Math.max(1, step / 2);
  const minX = Math.max(xStart + 2, best.x - step * 2);
  const maxX = Math.min(xEnd - 3, best.x + step * 2);
  const minY = Math.max(yStart + 2, best.y - step * 2);
  const maxY = Math.min(yEnd - 3, best.y + step * 2);
  const minS = Math.max(minScale, best.scale - 1.5);
  const maxS = Math.min(maxScale, best.scale + 1.5);
  const minA = Math.max(-30, best.angle - 5);
  const maxA = Math.min(30, best.angle + 5);

  for (let angle = minA; angle <= maxA; angle += 1) {
    for (let scale = minS; scale <= maxS; scale += 0.5) {
      for (let y = minY; y <= maxY; y += fineStep) {
        for (let x = minX; x <= maxX; x += fineStep) {
          const score = finderScore(image, x, y, scale, angle);
          if (score > refined.score) refined = { x, y, score, scale, angle };
        }
      }
    }
  }
  return refined;
}

function solveHomography(
  source: Array<[number, number]>,
  target: Array<[number, number]>,
) {
  const matrix: number[][] = [];
  const vector: number[] = [];

  for (let i = 0; i < 4; i++) {
    const [x, y] = source[i];
    const [u, v] = target[i];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    vector.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    vector.push(v);
  }

  for (let pivot = 0; pivot < 8; pivot++) {
    let best = pivot;
    for (let row = pivot + 1; row < 8; row++) {
      if (Math.abs(matrix[row][pivot]) > Math.abs(matrix[best][pivot])) best = row;
    }
    if (Math.abs(matrix[best][pivot]) < 1e-9) return null;
    [matrix[pivot], matrix[best]] = [matrix[best], matrix[pivot]];
    [vector[pivot], vector[best]] = [vector[best], vector[pivot]];

    const divisor = matrix[pivot][pivot];
    for (let col = pivot; col < 8; col++) matrix[pivot][col] /= divisor;
    vector[pivot] /= divisor;

    for (let row = 0; row < 8; row++) {
      if (row === pivot) continue;
      const factor = matrix[row][pivot];
      if (Math.abs(factor) < 1e-12) continue;
      for (let col = pivot; col < 8; col++) matrix[row][col] -= factor * matrix[pivot][col];
      vector[row] -= factor * vector[pivot];
    }
  }

  return [...vector, 1];
}

function project(h: number[], u: number, v: number): [number, number] {
  const w = h[6] * u + h[7] * v + 1;
  return [
    (h[0] * u + h[1] * v + h[2]) / w,
    (h[3] * u + h[4] * v + h[5]) / w,
  ];
}

function estimateCalibration(image: ImageData, anchors: ReadonlyArray<OptiFrameAnchor>) {
  const values: { dark: number; light: number }[] = [];
  for (const anchor of anchors) {
    const { x: cx, y: cy, scale, angle } = anchor;
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const ring: number[] = [];
    const center: number[] = [];
    for (let r = 0; r < FINDER_SIZE; r++) {
      for (let c = 0; c < FINDER_SIZE; c++) {
        const dx = (c - 4) * scale;
        const dy = (r - 4) * scale;
        const x = cx + dx * cos - dy * sin;
        const y = cy + dx * sin + dy * cos;
        const value = bilinear(image, x, y);
        if (finderBit(r, c)) center.push(value);
        else ring.push(value);
      }
    }
    values.push({
      dark: ring.reduce((sum, v) => sum + v, 0) / Math.max(1, ring.length),
      light: center.reduce((sum, v) => sum + v, 0) / Math.max(1, center.length),
    });
  }

  const dark = values.reduce((sum, value) => sum + value.dark, 0) / values.length;
  const light = values.reduce((sum, value) => sum + value.light, 0) / values.length;
  if (light - dark < 35) return null;
  return { dark, light };
}

function sampleModule(image: ImageData, x: number, y: number, moduleScale: number) {
  let total = 0;
  let count = 0;
  // At small physical scales, a fixed 3×3 neighborhood blends adjacent
  // modules. Scale the smoothing window with the module size instead.
  const radius = Math.max(0, Math.min(2, Math.floor(moduleScale / 3)));
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      total += bilinear(image, x + dx, y + dy);
      count++;
    }
  }
  return total / count;
}

export function decodeOptiFramePerspective(source: CanvasImageSource | ImageData): { frame: OptiFrame; diagnostics: OptiFramePerspectiveDiagnostics } | null {
  const started = performance.now();
  const image = toImageData(source);
  if (!image) return null;

  const tl = searchFinder(image, 'tl');
  const tr = searchFinder(image, 'tr');
  const bl = searchFinder(image, 'bl');
  const br = searchFinder(image, 'br');
  if (!tl || !tr || !bl || !br) return null;

  const anchors = [tl, tr, bl, br] as const;
  const target: Array<[number, number]> = [
    [8, 8],
    [119, 8],
    [8, 119],
    [119, 119],
  ];
  const homography = solveHomography(
    anchors.map(anchor => [anchor.x, anchor.y]),
    target,
  );
  if (!homography) return null;

  const reverse = solveHomography(target, anchors.map(anchor => [anchor.x, anchor.y]));
  if (!reverse) return null;

  const calibration = estimateCalibration(image, anchors);
  if (!calibration) return null;

  const topWidth = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const bottomWidth = Math.hypot(br.x - bl.x, br.y - bl.y);
  const leftHeight = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const rightHeight = Math.hypot(br.x - tr.x, br.y - tr.y);
  const longest = Math.max(topWidth, bottomWidth, leftHeight, rightHeight);
  const shortest = Math.max(1, Math.min(topWidth, bottomWidth, leftHeight, rightHeight));
  if (longest / shortest > 2.75) return null;

  const bits: number[] = [];
  for (let r = 0; r < OPTIFRAME_SIZE; r++) {
    for (let c = 0; c < OPTIFRAME_SIZE; c++) {
      if (isFinderCell(r, c)) continue;
      const [sx, sy] = project(reverse, c, r);
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) return null;
      const moduleScale = anchors.reduce((sum, anchor) => sum + anchor.scale, 0) / anchors.length;
      const raw = sampleModule(image, sx, sy, moduleScale);
      const normalized = Math.max(0, Math.min(255, (raw - calibration.dark) * 255 / (calibration.light - calibration.dark)));
      const level = quantize(normalized);
      bits.push((level >>> 1) & 1, level & 1);
    }
  }

  const frame = decodeBits(bits);
  if (!frame) return null;

  const confidence = anchors.reduce((sum, anchor) => sum + anchor.score, 0) / anchors.length;
  return {
    frame,
    diagnostics: {
      anchors: [tl, tr, bl, br],
      confidence,
      sampleWidth: image.width,
      sampleHeight: image.height,
      decodeMs: performance.now() - started,
    },
  };
}

export function optiFrameSelfTest() {
  const payload = new TextEncoder().encode('OptiCode experimental optical frame');
  const encoded = encodeOptiFrame(payload, 7, 19);
  const decoded = decodeOptiFrame(encoded.canvas);
  if (!decoded || decoded.sequence !== 7 || decoded.total !== 19 || decoded.payload.length !== payload.length || decoded.payload.some((v, i) => v !== payload[i])) {
    throw new Error('OptiFrame round trip failed.');
  }

  const warped = document.createElement('canvas');
  warped.width = 360;
  warped.height = 320;
  const ctx = warped.getContext('2d');
  if (!ctx) throw new Error('Perspective self-test canvas unavailable.');
  ctx.fillStyle = '#777';
  ctx.fillRect(0, 0, warped.width, warped.height);
  ctx.setTransform(1, 0.16, -0.08, 1, 70, 60);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(encoded.canvas, 0, 0);
  const perspective = decodeOptiFramePerspective(warped);
  if (!perspective || perspective.frame.sequence !== 7 || perspective.frame.total !== 19 || perspective.frame.payload.length !== payload.length || perspective.frame.payload.some((v, i) => v !== payload[i])) {
    throw new Error('OptiFrame perspective self-test failed.');
  }

  return { payloadBytes: payload.length, capacityBytes: getOptiFrameCapacity() };
}

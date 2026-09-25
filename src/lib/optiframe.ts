export const OPTIFRAME_MAGIC = [0x4f, 0x43, 0x46, 0x31] as const;
export const OPTIFRAME_VERSION = 1;
export const OPTIFRAME_GRID = 72;
export const OPTIFRAME_SIZE = 864;
export const OPTIFRAME_MAX_PAYLOAD = 2200;

const HEADER_BYTES = 16;
const FINDER = 9;
const finderOrigins = [
  [0, 0],
  [OPTIFRAME_GRID - FINDER, 0],
  [0, OPTIFRAME_GRID - FINDER],
] as const;

type FrameHeader = {
  sequence: number;
  payloadLength: number;
};

export type OptiFrameDecoded = FrameHeader & { payload: Uint8Array };

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function isFinderCell(row: number, col: number) {
  return finderOrigins.some(([x, y]) => row >= y && row < y + FINDER && col >= x && col < x + FINDER);
}

function setFinder(cells: Uint8Array, originX: number, originY: number) {
  for (let row = 0; row < FINDER; row += 1) {
    for (let col = 0; col < FINDER; col += 1) {
      const edge = row === 0 || row === FINDER - 1 || col === 0 || col === FINDER - 1;
      const inner = row >= 2 && row <= 6 && col >= 2 && col <= 6;
      cells[(originY + row) * OPTIFRAME_GRID + originX + col] = edge || inner ? 0 : 15;
    }
  }
}

function getBytes(view: DataView, offset: number) {
  return view.getUint32(offset, false);
}

function writeHeader(payload: Uint8Array, sequence: number) {
  const total = HEADER_BYTES + payload.length + 4;
  const out = new Uint8Array(total);
  out.set(OPTIFRAME_MAGIC, 0);
  out[4] = OPTIFRAME_VERSION;
  out[5] = 0x10; // 16-level grayscale, 4 bits per cell.
  new DataView(out.buffer).setUint32(6, sequence >>> 0, false);
  new DataView(out.buffer).setUint16(10, payload.length, false);
  new DataView(out.buffer).setUint32(12, crc32(payload), false);
  out.set(payload, HEADER_BYTES);
  new DataView(out.buffer).setUint32(HEADER_BYTES + payload.length, crc32(out.subarray(0, HEADER_BYTES + payload.length)), false);
  return out;
}

function readHeader(bytes: Uint8Array) {
  if (bytes.length < HEADER_BYTES + 4) throw new Error('OptiFrame payload is too short.');
  if (!OPTIFRAME_MAGIC.every((value, index) => bytes[index] === value)) throw new Error('OptiFrame magic mismatch.');
  if (bytes[4] !== OPTIFRAME_VERSION || bytes[5] !== 0x10) throw new Error('Unsupported OptiFrame version.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const payloadLength = view.getUint16(10, false);
  if (payloadLength > OPTIFRAME_MAX_PAYLOAD) throw new Error('OptiFrame payload exceeds the experimental limit.');
  if (HEADER_BYTES + payloadLength + 4 !== bytes.length) throw new Error('OptiFrame length mismatch.');
  const sequence = getBytes(view, 6);
  const payload = bytes.slice(HEADER_BYTES, HEADER_BYTES + payloadLength);
  if (crc32(payload) !== getBytes(view, 12)) throw new Error('OptiFrame payload CRC mismatch.');
  if (crc32(bytes.subarray(0, HEADER_BYTES + payloadLength)) !== getBytes(view, HEADER_BYTES + payloadLength)) {
    throw new Error('OptiFrame frame CRC mismatch.');
  }
  return { sequence, payload };
}

function byteToNibbles(bytes: Uint8Array) {
  const cells = new Uint8Array(bytes.length * 2);
  for (let i = 0; i < bytes.length; i += 1) {
    cells[i * 2] = bytes[i] >>> 4;
    cells[i * 2 + 1] = bytes[i] & 0x0f;
  }
  return cells;
}

function nibblesToBytes(nibbles: Uint8Array) {
  const out = new Uint8Array(Math.floor(nibbles.length / 2));
  for (let i = 0; i < out.length; i += 1) out[i] = (nibbles[i * 2] << 4) | nibbles[i * 2 + 1];
  return out;
}

export function optiFrameCapacityBytes() {
  let cells = OPTIFRAME_GRID * OPTIFRAME_GRID;
  cells -= FINDER * FINDER * finderOrigins.length;
  return Math.floor(cells / 2) - HEADER_BYTES - 4;
}

export function encodeOptiFrame(payload: Uint8Array, sequence = 0) {
  if (payload.length > Math.min(OPTIFRAME_MAX_PAYLOAD, optiFrameCapacityBytes())) {
    throw new Error('OptiFrame payload is too large for the experimental 16-level optical symbol grid.');
  }
  const packet = writeHeader(payload, sequence);
  const cells = new Uint8Array(OPTIFRAME_GRID * OPTIFRAME_GRID);
  cells.fill(15);
  for (const [x, y] of finderOrigins) setFinder(cells, x, y);

  const symbols = byteToNibbles(packet);
  let cursor = 0;
  for (let row = 0; row < OPTIFRAME_GRID && cursor < symbols.length; row += 1) {
    for (let col = 0; col < OPTIFRAME_GRID && cursor < symbols.length; col += 1) {
      if (isFinderCell(row, col)) continue;
      cells[row * OPTIFRAME_GRID + col] = symbols[cursor++];
    }
  }
  return cells;
}

export function renderOptiFrame(cells: Uint8Array, size = OPTIFRAME_SIZE) {
  if (cells.length !== OPTIFRAME_GRID * OPTIFRAME_GRID) throw new Error('Invalid OptiFrame cell matrix.');
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  const cellSize = size / OPTIFRAME_GRID;
  for (let row = 0; row < OPTIFRAME_GRID; row += 1) {
    for (let col = 0; col < OPTIFRAME_GRID; col += 1) {
      const level = cells[row * OPTIFRAME_GRID + col];
      const value = Math.round((level / 15) * 255);
      ctx.fillStyle = `rgb(${value},${value},${value})`;
      ctx.fillRect(Math.floor(col * cellSize), Math.floor(row * cellSize), Math.ceil(cellSize), Math.ceil(cellSize));
    }
  }
  return canvas;
}

function quantize(value: number) {
  return Math.max(0, Math.min(15, Math.round((value / 255) * 15)));
}

export function decodeOptiFrame(image: ImageData) {
  if (image.width < OPTIFRAME_GRID || image.height < OPTIFRAME_GRID) throw new Error('Image is too small for OptiFrame.');
  const sample = (row: number, col: number) => {
    const x = Math.min(image.width - 1, Math.floor((col + 0.5) * image.width / OPTIFRAME_GRID));
    const y = Math.min(image.height - 1, Math.floor((row + 0.5) * image.height / OPTIFRAME_GRID));
    const i = (y * image.width + x) * 4;
    return quantize((image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3);
  };

  for (const [x, y] of finderOrigins) {
    for (let row = 0; row < FINDER; row += 1) {
      for (let col = 0; col < FINDER; col += 1) {
        const expected = (row === 0 || row === FINDER - 1 || col === 0 || col === FINDER - 1 || (row >= 2 && row <= 6 && col >= 2 && col <= 6)) ? 0 : 15;
        if (Math.abs(sample(y + row, x + col) - expected) > 2) throw new Error('OptiFrame finder pattern not detected.');
      }
    }
  }

  const symbols = new Uint8Array((OPTIFRAME_GRID * OPTIFRAME_GRID - FINDER * FINDER * finderOrigins.length));
  let cursor = 0;
  for (let row = 0; row < OPTIFRAME_GRID && cursor < symbols.length; row += 1) {
    for (let col = 0; col < OPTIFRAME_GRID && cursor < symbols.length; col += 1) {
      if (isFinderCell(row, col)) continue;
      symbols[cursor++] = sample(row, col);
    }
  }

  return readHeader(nibblesToBytes(symbols));
}

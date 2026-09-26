const TRANSFER_MAGIC = new Uint8Array([0x4f, 0x50, 0x54, 0x43, 0x4f, 0x44, 0x45, 0x31]);
const MAX_TRANSFER_BYTES = 64 * 1024 * 1024;

export type OptiCodeFileTransfer = {
  name: string;
  type: string;
  size: number;
  data: Uint8Array;
};

function sameMagic(data: Uint8Array) {
  if (data.length < TRANSFER_MAGIC.length) return false;
  return TRANSFER_MAGIC.every((value, index) => data[index] === value);
}

function writeU32(value: number) {
  return new Uint8Array([
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ]);
}

function readU32(data: Uint8Array, offset: number) {
  return (((data[offset] << 24) >>> 0) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}

function concat(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

export async function createOptiCodeFileTransfer(file: File) {
  if (file.size > MAX_TRANSFER_BYTES) {
    throw new Error('For the first file-transfer MVP, files are limited to 64 MB.');
  }

  const header = new TextEncoder().encode(JSON.stringify({
    name: file.name || 'received-file',
    type: file.type || 'application/octet-stream',
    size: file.size,
  }));

  if (header.length > 4096) throw new Error('File metadata is too large.');

  const body = new Uint8Array(await file.arrayBuffer());
  return concat(concat(TRANSFER_MAGIC, writeU32(header.length)), concat(header, body));
}

export function decodeOptiCodeFileTransfer(payload: Uint8Array): OptiCodeFileTransfer | null {
  if (!sameMagic(payload) || payload.length < TRANSFER_MAGIC.length + 4) return null;

  const headerLength = readU32(payload, TRANSFER_MAGIC.length);
  const headerStart = TRANSFER_MAGIC.length + 4;
  const dataStart = headerStart + headerLength;
  if (headerLength < 2 || headerLength > 4096 || dataStart > payload.length) return null;

  try {
    const header = JSON.parse(new TextDecoder().decode(payload.slice(headerStart, dataStart))) as { name?: unknown; type?: unknown; size?: unknown };
    const data = payload.slice(dataStart);
    const size = Number(header.size);
    if (typeof header.name !== 'string' || typeof header.type !== 'string' || !Number.isSafeInteger(size) || size < 0 || size !== data.length || size > MAX_TRANSFER_BYTES) return null;
    return { name: header.name, type: header.type || 'application/octet-stream', size, data };
  } catch {
    return null;
  }
}

export { MAX_TRANSFER_BYTES };

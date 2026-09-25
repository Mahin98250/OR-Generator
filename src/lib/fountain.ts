const FOUNTAIN_PREFIX = 'ORF1:';

export const FOUNTAIN_BLOCK_BYTES = 1750;
export const FOUNTAIN_GRID_SIZE = 4;
export const FOUNTAIN_MAX_FILE_SIZE = 64 * 1024 * 1024;
export const FOUNTAIN_OVERHEAD = 0.18;

export type FountainPlan = {
  session: string;
  hash: string;
  name: string;
  mime: string;
  size: number;
  blocks: number;
  blockBytes: number;
  recommended: number;
  getDroplet: (lane?: number, sequence?: number) => Promise<string>;
};

export type FountainDroplet = {
  session: string;
  mime: string;
  name: string;
  size: number;
  hash: string;
  blocks: number;
  blockBytes: number;
  seed: number;
  degree: number;
  data: string;
};

function b64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function unb64(value: string) {
  const s = atob(value);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

async function sha256(bytes: Uint8Array) {
  const input = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.slice().buffer;
  const digest = await crypto.subtle.digest('SHA-256', input as ArrayBuffer);
  return Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, '0')).join('');
}

function encodeName(name: string) { return btoa(unescape(encodeURIComponent(name))).replace(/=/g, ''); }
function decodeName(name: string) { return decodeURIComponent(escape(atob(name))); }

function rng(seed: number) {
  let x = seed >>> 0 || 0x9e3779b9;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function degreeFor(seed: number, blocks: number) {
  const r = rng(seed);
  const u = r();
  if (blocks <= 2) return 1;
  if (u < 0.22) return 1;
  if (u < 0.50) return 2;
  if (u < 0.70) return 3;
  if (u < 0.82) return 4;
  if (u < 0.90) return 6;
  if (u < 0.95) return 10;
  if (u < 0.985) return 20;
  return Math.min(40, blocks);
}

function indexesFor(seed: number, blocks: number, degree: number) {
  if (degree === 1 && (seed >>> 0) >= 0x80000000) return [seed & 0x7fffffff];
  const random = rng(seed);
  const chosen = new Set<number>();
  while (chosen.size < degree) chosen.add(Math.floor(random() * blocks));
  return [...chosen];
}

function xorInto(target: Uint8Array, source: Uint8Array) {
  for (let i = 0; i < target.length; i += 1) target[i] ^= source[i] || 0;
}

function normalizeBlock(bytes: Uint8Array, blockBytes: number) {
  const out = new Uint8Array(blockBytes);
  out.set(bytes.subarray(0, blockBytes));
  return out;
}

export async function createFountainTransfer(file: File): Promise<FountainPlan> {
  if (file.size > FOUNTAIN_MAX_FILE_SIZE) throw new Error('High-speed fountain mode supports files up to 64 MB. Use compatibility mode for larger files.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await sha256(bytes);
  const session = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const blocks = Math.max(1, Math.ceil(file.size / FOUNTAIN_BLOCK_BYTES));
  const source = Array.from({ length: blocks }, (_, i) => normalizeBlock(bytes.subarray(i * FOUNTAIN_BLOCK_BYTES, Math.min(bytes.length, (i + 1) * FOUNTAIN_BLOCK_BYTES)), FOUNTAIN_BLOCK_BYTES));
  const encodedName = encodeName(file.name);
  const mime = encodeURIComponent(file.type || 'application/octet-stream');
  const recommended = Math.ceil(blocks * (1 + FOUNTAIN_OVERHEAD));

  return {
    session, hash, name: file.name, mime: file.type || 'application/octet-stream',
    size: file.size, blocks, blockBytes: FOUNTAIN_BLOCK_BYTES, recommended,
    getDroplet: async (lane = 0, sequence = 0) => {
      const systematic = lane < 2;
      const systematicOrdinal = sequence * 2 + lane;
      const target = systematic ? (systematicOrdinal % blocks) : (Math.floor(Math.random() * blocks) >>> 0);
      const seed = systematic ? ((0x80000000 | target) >>> 0) : ((Math.floor(Math.random() * 0x7fffffff) ^ (sequence * 0x45d9f3b) ^ (lane * 0x9e3779b9)) >>> 0);
      const degree = systematic ? 1 : degreeFor(seed, blocks);
      const indexes = systematic ? [target] : indexesFor(seed, blocks, degree);
      const payload = new Uint8Array(FOUNTAIN_BLOCK_BYTES);
      for (const index of indexes) xorInto(payload, source[index]);
      return [FOUNTAIN_PREFIX + session, mime, encodedName, file.size, hash, blocks, FOUNTAIN_BLOCK_BYTES, seed, degree, b64(payload)].join('|');
    },
  };
}

export function isFountainFrame(value: string) { return value.startsWith(FOUNTAIN_PREFIX); }

export function parseFountainFrame(value: string): FountainDroplet | null {
  const p = value.split('|');
  if (p.length !== 10 || !isFountainFrame(value)) return null;
  const [sessionRaw, mimeRaw, nameRaw, sizeRaw, hashRaw, blocksRaw, blockBytesRaw, seedRaw, degreeRaw, data] = p;
  const session = sessionRaw.slice(FOUNTAIN_PREFIX.length);
  const size = Number(sizeRaw), blocks = Number(blocksRaw), blockBytes = Number(blockBytesRaw);
  const seed = Number(seedRaw), degree = Number(degreeRaw);
  if (!session || !mimeRaw || !nameRaw || !/^[a-f0-9]{64}$/i.test(hashRaw) ||
      !Number.isInteger(size) || size < 0 || size > FOUNTAIN_MAX_FILE_SIZE ||
      !Number.isInteger(blocks) || blocks < 1 || blocks > Math.ceil(FOUNTAIN_MAX_FILE_SIZE / FOUNTAIN_BLOCK_BYTES) ||
      blockBytes !== FOUNTAIN_BLOCK_BYTES || !Number.isInteger(seed) || seed < 0 ||
      !Number.isInteger(degree) || degree < 1 || degree > Math.min(40, blocks) || !data) return null;
  try {
    const bytes = unb64(data);
    if (bytes.length !== blockBytes) return null;
    return { session, mime: decodeURIComponent(mimeRaw), name: decodeName(nameRaw), size, hash: hashRaw.toLowerCase(), blocks, blockBytes, seed, degree, data };
  } catch { return null; }
}

export type FountainDecoder = {
  add: (frame: FountainDroplet) => { duplicate: boolean; solved: number; total: number; complete: boolean };
  reconstruct: () => Promise<{ bytes: Uint8Array; hash: string } | null>;
  seen: () => number;
};

export function createFountainDecoder(meta: Pick<FountainDroplet, 'size'|'hash'|'blocks'|'blockBytes'|'session'|'mime'|'name'>): FountainDecoder {
  const equations = new Map<number, { indexes: Set<number>; data: Uint8Array }>();
  const solved = new Map<number, Uint8Array>();
  const seenSeeds = new Set<number>();

  function reduceEquation(eq: { indexes: Set<number>; data: Uint8Array }) {
    for (const index of [...eq.indexes]) {
      const block = solved.get(index);
      if (block) { xorInto(eq.data, block); eq.indexes.delete(index); }
    }
  }

  function propagate(index: number, block: Uint8Array) {
    solved.set(index, block);
    for (const [seed, eq] of equations) {
      if (eq.indexes.has(index)) {
        xorInto(eq.data, block);
        eq.indexes.delete(index);
        if (eq.indexes.size === 1) {
          const only = [...eq.indexes][0];
          const candidate = eq.data.slice();
          equations.delete(seed);
          if (!solved.has(only)) propagate(only, candidate);
        } else if (eq.indexes.size === 0) {
          equations.delete(seed);
        }
      }
    }
  }

  return {
    add(frame) {
      if (frame.session !== meta.session || frame.hash !== meta.hash || frame.blocks !== meta.blocks || frame.size !== meta.size || frame.blockBytes !== meta.blockBytes) {
        throw new Error('This fountain frame conflicts with the active transfer.');
      }
      if (seenSeeds.has(frame.seed)) return { duplicate: true, solved: solved.size, total: meta.blocks, complete: solved.size === meta.blocks };
      seenSeeds.add(frame.seed);
      const eq = { indexes: new Set(indexesFor(frame.seed, frame.blocks, frame.degree)), data: unb64(frame.data) };
      reduceEquation(eq);
      if (eq.indexes.size === 1) {
        const index = [...eq.indexes][0];
        equations.delete(frame.seed);
        if (!solved.has(index)) propagate(index, eq.data);
      } else if (eq.indexes.size > 1) {
        equations.set(frame.seed, eq);
      }
      return { duplicate: false, solved: solved.size, total: meta.blocks, complete: solved.size === meta.blocks };
    },
    async reconstruct() {
      if (solved.size !== meta.blocks) return null;
      const bytes = new Uint8Array(meta.size);
      for (let i = 0; i < meta.blocks; i += 1) {
        const block = solved.get(i);
        if (!block) return null;
        bytes.set(block.subarray(0, Math.min(meta.blockBytes, meta.size - i * meta.blockBytes)), i * meta.blockBytes);
      }
      const hash = await sha256(bytes);
      if (hash !== meta.hash) throw new Error('Fountain integrity verification failed. The optical stream was incomplete or corrupted.');
      return { bytes, hash };
    },
    seen: () => seenSeeds.size,
  };
}

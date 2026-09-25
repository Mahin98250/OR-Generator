import { clearSession, countChunks, getChunkIndexes, getChunks, getSession, putChunk, putSession } from './sessionStore';

export const IMAGE_QR_PREFIX = 'ORIMG1:';
export const MULTI_IMAGE_QR_PREFIX = 'ORMIMG1:';
const MAX_SINGLE_PAYLOAD_CHARS = 2850;
const MULTI_CHUNK_CHARS = 1800;
const MAX_MULTI_FRAMES = 25000;
const MAX_MULTI_IMAGE_SIZE = 25 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unable to read image.')); };
    img.src = url;
  });
}

function render(img: HTMLImageElement, side: number, quality: number) {
  const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width, height };
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
  }
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function shortHash(bytes: Uint8Array) {
  const safeBuffer = bytes.slice().buffer as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', safeBuffer);
  return Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, '0')).join('');
}

function encodeName(name: string) {
  return btoa(unescape(encodeURIComponent(name))).replace(/=/g, '');
}

function decodeName(value: string) {
  return decodeURIComponent(escape(atob(value)));
}

function sessionKey(id: string) {
  return `multi-image:${id}`;
}

type MultiImageSession = {
  key: string;
  type: 'multi-image';
  id: string;
  mime: string;
  name: string;
  size: number;
  hash: string;
  total: number;
  createdAt: number;
};

export async function addMultiImageChunk(value: string) {
  const parsed = parseMultiImageQr(value);
  if (!parsed) return null;

  const key = sessionKey(parsed.id);
  const current = await getSession(key) as MultiImageSession | undefined;

  const compatible = current &&
    current.type === 'multi-image' &&
    current.hash === parsed.hash &&
    current.total === parsed.total &&
    current.mime === parsed.mime &&
    current.name === parsed.name;

  const session: MultiImageSession = compatible
    ? current
    : {
      key,
      type: 'multi-image',
      id: parsed.id,
      mime: parsed.mime,
      name: parsed.name,
      size: 0,
      hash: parsed.hash,
      total: parsed.total,
      createdAt: Date.now(),
    };

  if (!compatible && current) await clearSession(key);
  if (!compatible) await putSession(session);

  const stored = await putChunk(key, parsed.index, parsed.data);
  const received = await countChunks(key);

  return {
    ...parsed,
    received,
    complete: received === session.total,
    duplicate: stored.duplicate,
    missingCount: Math.max(0, session.total - received),
  };
}

export async function getMultiImageMissingFrames(id: string) {
  const key = sessionKey(id);
  const stored = await getSession(key);
  if (!stored || stored.type !== 'multi-image') return [];

  const received = await getChunkIndexes(key);
  const have = new Set(received);
  const missing: number[] = [];
  for (let i = 1; i <= stored.total; i++) {
    if (!have.has(i)) missing.push(i);
  }
  return missing;
}

export async function clearMultiImage(id: string) {
  await clearSession(sessionKey(id));
}

export async function reconstructMultiImage(id: string) {
  const key = sessionKey(id);
  const state = await getSession(key) as MultiImageSession | undefined;
  if (!state || state.type !== 'multi-image') return null;

  const chunks = await getChunks(key);
  if (chunks.length !== state.total) return null;

  chunks.sort((a, b) => a.index - b.index);
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].index !== i + 1) return null;
  }

  const bytesParts: Uint8Array[] = [];
  let totalBytes = 0;

  for (const chunk of chunks) {
    let decoded: Uint8Array;
    try {
      decoded = fromBase64(chunk.data);
    } catch {
      throw new Error('The reconstructed image data is invalid. Rescan the missing frame(s).');
    }
    bytesParts.push(decoded);
    totalBytes += decoded.byteLength;
    if (totalBytes > MAX_MULTI_IMAGE_SIZE) {
      throw new Error('The reconstructed image exceeds the supported 25 MB limit.');
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const part of bytesParts) {
    bytes.set(part, offset);
    offset += part.length;
  }

  if (await shortHash(bytes) !== state.hash) {
    throw new Error('Image verification failed. Please rescan the missing frame(s).');
  }

  const blob = new Blob([bytes], { type: state.mime });
  await clearSession(key);

  return {
    url: URL.createObjectURL(blob),
    name: state.name || 'reconstructed-original-image',
    size: bytes.byteLength,
    mime: state.mime,
  };
}

export async function encodeImageForQr(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Please choose an image smaller than 15 MB.');
  const img = await loadImage(file);
  const attempts = [[4096,.92],[3072,.88],[2048,.84],[1600,.80],[1280,.76],[1024,.72],[900,.68],[800,.64],[700,.60],[600,.56],[512,.52],[448,.48],[384,.44],[320,.40],[256,.36]] as const;
  for (const [side, quality] of attempts) {
    const rendered = render(img, side, quality);
    const payload = IMAGE_QR_PREFIX + rendered.dataUrl;
    if (payload.length <= MAX_SINGLE_PAYLOAD_CHARS) {
      const preservedDimensions = rendered.width === img.naturalWidth && rendered.height === img.naturalHeight;
      return { payload, previewUrl: rendered.dataUrl, width: rendered.width, height: rendered.height, originalWidth: img.naturalWidth, originalHeight: img.naturalHeight, preservedDimensions };
    }
  }
  throw new Error('This photo cannot fit into one QR code. Use Multi-QR Photo for the original file with no downscaling.');
}

export function isImageQr(value: string) {
  return value.startsWith(IMAGE_QR_PREFIX);
}

export function decodeImageQr(value: string) {
  if (!isImageQr(value)) return null;
  const data = value.slice(IMAGE_QR_PREFIX.length);
  return data.startsWith('data:image/') ? data : null;
}

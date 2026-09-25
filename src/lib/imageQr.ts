export const IMAGE_QR_PREFIX = 'ORIMG1:';
export const MULTI_IMAGE_QR_PREFIX = 'ORMIMG1:';
const MAX_SINGLE_PAYLOAD_CHARS = 2850;
const MULTI_CHUNK_CHARS = 1800;

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
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function shortHash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).slice(0, 8).map(v => v.toString(16).padStart(2, '0')).join('');
}

export async function encodeImageForMultiQr(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 25 * 1024 * 1024) throw new Error('For Multi-QR Photo, choose an image smaller than 25 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const hash = await shortHash(bytes);
  const base = `${MULTI_IMAGE_QR_PREFIX}${id}|${file.type}|${hash}|`;
  const encoded = toBase64(bytes);
  const total = Math.ceil(encoded.length / MULTI_CHUNK_CHARS);
  const chunks = Array.from({ length: total }, (_, index) =>
    `${base}${index + 1}|${total}|${encoded.slice(index * MULTI_CHUNK_CHARS, (index + 1) * MULTI_CHUNK_CHARS)}`
  );
  return { id, hash, chunks, total, size: file.size, mime: file.type, name: file.name };
}

export function isMultiImageQr(value: string) {
  return value.startsWith(MULTI_IMAGE_QR_PREFIX);
}

export function parseMultiImageQr(value: string) {
  if (!isMultiImageQr(value)) return null;
  const parts = value.split('|');
  if (parts.length < 6) return null;
  const [, id, mime, hash, indexRaw, totalRaw, data] = parts;
  const index = Number(indexRaw), total = Number(totalRaw);
  if (!id || !mime || !hash || !Number.isInteger(index) || !Number.isInteger(total) || index < 1 || total < index || !data) return null;
  return { id, mime, hash, index, total, data };
}

export function addMultiImageChunk(value: string) {
  const parsed = parseMultiImageQr(value);
  if (!parsed) return null;
  const key = `or-multi-image-${parsed.id}`;
  const current = JSON.parse(sessionStorage.getItem(key) || 'null') as { mime:string; hash:string; total:number; chunks:Record<string,string> } | null;
  const state = current && current.hash === parsed.hash && current.total === parsed.total
    ? current
    : { mime: parsed.mime, hash: parsed.hash, total: parsed.total, chunks: {} };
  state.chunks[String(parsed.index)] = parsed.data;
  sessionStorage.setItem(key, JSON.stringify(state));
  return { ...parsed, received: Object.keys(state.chunks).length, complete: Object.keys(state.chunks).length === state.total };
}

export async function reconstructMultiImage(id: string) {
  const raw = sessionStorage.getItem(`or-multi-image-${id}`);
  if (!raw) return null;
  const state = JSON.parse(raw) as { mime:string; hash:string; total:number; chunks:Record<string,string> };
  const encoded = Array.from({ length: state.total }, (_, i) => state.chunks[String(i + 1)]).join('');
  if (!encoded || encoded.length === 0) return null;
  const bytes = fromBase64(encoded);
  if (await shortHash(bytes) !== state.hash) throw new Error('Image verification failed. Please rescan the missing frame(s).');
  const blob = new Blob([bytes], { type: state.mime });
  sessionStorage.removeItem(`or-multi-image-${id}`);
  return URL.createObjectURL(blob);
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

export function isImageQr(value: string) { return value.startsWith(IMAGE_QR_PREFIX); }
export function decodeImageQr(value: string) {
  if (!isImageQr(value)) return null;
  const data = value.slice(IMAGE_QR_PREFIX.length);
  return data.startsWith('data:image/') ? data : null;
}

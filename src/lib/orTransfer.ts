export const OR_TRANSFER_PREFIX = 'ORX1:';
export const OR_TRANSFER_CHUNK_CHARS = 1200;
export const OR_TRANSFER_MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_TRANSFER_FRAMES = 150000;

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

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, '0')).join('');
}

function encodeName(name: string) {
  return btoa(unescape(encodeURIComponent(name))).replace(/=/g, '');
}

function decodeName(name: string) {
  return decodeURIComponent(escape(atob(name)));
}

function storageKey(session: string) {
  return `or-transfer-${session}`;
}

function readState(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeState(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeState(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private/restricted contexts.
  }
}

type TransferState = {
  mime: string;
  name: string;
  size: number;
  hash: string;
  total: number;
  chunks: Record<string, string>;
};

export type TransferFrame = {
  session:string;
  mime:string;
  name:string;
  size:number;
  hash:string;
  index:number;
  total:number;
  data:string;
};

export async function createTransfer(file: File) {
  if (file.size > OR_TRANSFER_MAX_FILE_SIZE) throw new Error('Choose a file smaller than 100 MB.');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await sha256(bytes);
  const session = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const encoded = toBase64(bytes);
  const total = Math.max(1, Math.ceil(encoded.length / OR_TRANSFER_CHUNK_CHARS));

  if (total > MAX_TRANSFER_FRAMES) {
    throw new Error('This file would require too many QR frames. Choose a smaller file.');
  }

  const name = encodeName(file.name);
  const mime = encodeURIComponent(file.type || 'application/octet-stream');

  const frames = Array.from({ length: total }, (_, i) =>
    `${OR_TRANSFER_PREFIX}${session}|${mime}|${name}|${file.size}|${hash}|${i + 1}|${total}|${encoded.slice(i * OR_TRANSFER_CHUNK_CHARS, (i + 1) * OR_TRANSFER_CHUNK_CHARS)}`
  );

  return {
    session,
    hash,
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size:file.size,
    total,
    frames,
  };
}

export function isTransferFrame(value:string) {
  return value.startsWith(OR_TRANSFER_PREFIX);
}

export function parseTransferFrame(value:string): TransferFrame | null {
  const parts=value.split('|');
  if (!isTransferFrame(value) || parts.length !== 8) return null;

  const [,session,mimeRaw,nameRaw,sizeRaw,indexRaw,totalRaw,data]=parts;
  const index=Number(indexRaw);
  const total=Number(totalRaw);
  const size=Number(sizeRaw);

  if (
    !session ||
    !mimeRaw ||
    !nameRaw ||
    !hashSafe(parts[5]) ||
    !data ||
    !Number.isInteger(index) ||
    !Number.isInteger(total) ||
    !Number.isInteger(size) ||
    index < 1 ||
    total < 1 ||
    index > total ||
    total > MAX_TRANSFER_FRAMES ||
    size < 0 ||
    data.length > OR_TRANSFER_CHUNK_CHARS
  ) return null;

  try {
    return {
      session,
      mime:decodeURIComponent(mimeRaw),
      name:decodeName(nameRaw),
      size,
      hash:parts[5],
      index,
      total,
      data,
    };
  } catch {
    return null;
  }
}

function hashSafe(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function getTransferMissingFrames(session:string) {
  const raw=readState(storageKey(session));
  if(!raw) return [];

  try {
    const state=JSON.parse(raw) as TransferState;
    if (!Number.isInteger(state.total) || state.total < 1 || state.total > MAX_TRANSFER_FRAMES) return [];

    const missing:number[]=[];
    for(let i=1;i<=state.total;i++) {
      if(!state.chunks[String(i)]) missing.push(i);
    }
    return missing;
  } catch {
    return [];
  }
}

export function clearTransfer(session:string) {
  removeState(storageKey(session));
}

export function addTransferFrame(frame:TransferFrame) {
  const key=storageKey(frame.session);
  let current: TransferState | null = null;

  try {
    const raw=readState(key);
    current=raw ? JSON.parse(raw) as TransferState : null;
  } catch {
    current=null;
  }

  const compatible = current &&
    current.hash===frame.hash &&
    current.total===frame.total &&
    current.size===frame.size &&
    current.mime===frame.mime &&
    current.name===frame.name;

  const state: TransferState = compatible
    ? current
    : {
      mime:frame.mime,
      name:frame.name,
      size:frame.size,
      hash:frame.hash,
      total:frame.total,
      chunks:{},
    };

  const existing=state.chunks[String(frame.index)];
  if (existing && existing !== frame.data) {
    throw new Error('Conflicting transfer frame detected. Restart this transfer session.');
  }

  const duplicate=Boolean(existing);
  if (!duplicate) state.chunks[String(frame.index)]=frame.data;

  if (!writeState(key,JSON.stringify(state))) {
    throw new Error('Browser storage is unavailable. Allow site storage and try again.');
  }

  const received=Object.keys(state.chunks).length;
  const missing=getTransferMissingFrames(frame.session);

  return {
    ...frame,
    received,
    complete:received===state.total,
    duplicate,
    missing,
  };
}

export async function reconstructTransfer(session:string) {
  const key=storageKey(session);
  const raw=readState(key);
  if(!raw) return null;

  let state: TransferState;
  try {
    state=JSON.parse(raw) as TransferState;
  } catch {
    throw new Error('The transfer session is corrupted. Restart the transfer.');
  }

  const missing=getTransferMissingFrames(session);
  if(missing.length) return null;

  const encoded=Array.from({length:state.total},(_,i)=>state.chunks[String(i+1)]).join('');

  let bytes: Uint8Array;
  try {
    bytes=fromBase64(encoded);
  } catch {
    throw new Error('The reconstructed file data is invalid. Rescan the missing frame(s).');
  }

  if(bytes.byteLength!==state.size || await sha256(bytes)!==state.hash) {
    throw new Error('Integrity verification failed. Rescan the missing frame(s).');
  }

  removeState(key);

  return {
    url:URL.createObjectURL(new Blob([bytes],{type:state.mime})),
    name:state.name,
    size:state.size,
    mime:state.mime,
  };
}

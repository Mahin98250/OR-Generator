export const OR_TRANSFER_PREFIX = 'ORX1:';
export const OR_TRANSFER_CHUNK_CHARS = 1200;
export const OR_TRANSFER_MAX_FILE_SIZE = 100 * 1024 * 1024;

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
  return btoa(binary);
}
function fromBase64(value: string) {
  const binary = atob(value); const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, '0')).join('');
}
function encodeName(name: string) { return btoa(unescape(encodeURIComponent(name))).replace(/=/g, ''); }
function decodeName(name: string) { return decodeURIComponent(escape(atob(name))); }

export type TransferFrame = { session:string; mime:string; name:string; size:number; hash:string; index:number; total:number; data:string };

export async function createTransfer(file: File) {
  if (file.size > OR_TRANSFER_MAX_FILE_SIZE) throw new Error('Choose a file smaller than 100 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await sha256(bytes);
  const session = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const encoded = toBase64(bytes);
  const total = Math.max(1, Math.ceil(encoded.length / OR_TRANSFER_CHUNK_CHARS));
  const name = encodeName(file.name);
  const mime = encodeURIComponent(file.type || 'application/octet-stream');
  const frames = Array.from({ length: total }, (_, i) =>
    `${OR_TRANSFER_PREFIX}${session}|${mime}|${name}|${file.size}|${hash}|${i + 1}|${total}|${encoded.slice(i * OR_TRANSFER_CHUNK_CHARS, (i + 1) * OR_TRANSFER_CHUNK_CHARS)}`
  );
  return { session, hash, name: file.name, mime: file.type || 'application/octet-stream', size:file.size, total, frames };
}
export function isTransferFrame(value:string) { return value.startsWith(OR_TRANSFER_PREFIX); }
export function parseTransferFrame(value:string): TransferFrame | null {
  const parts=value.split('|'); if (!isTransferFrame(value) || parts.length<8) return null;
  const [,session,mimeRaw,nameRaw,sizeRaw,hash,indexRaw,totalRaw,data]=parts;
  const index=Number(indexRaw), total=Number(totalRaw), size=Number(sizeRaw);
  if (!session||!mimeRaw||!nameRaw||!hash||!data||!Number.isInteger(index)||!Number.isInteger(total)||!Number.isInteger(size)||index<1||total<index) return null;
  try { return {session,mime:decodeURIComponent(mimeRaw),name:decodeName(nameRaw),size,hash,index,total,data}; } catch { return null; }
}
export function addTransferFrame(frame:TransferFrame) {
  const key=`or-transfer-${frame.session}`;
  const current=JSON.parse(sessionStorage.getItem(key)||'null') as {mime:string;name:string;size:number;hash:string;total:number;chunks:Record<string,string>}|null;
  const state=current&&current.hash===frame.hash&&current.total===frame.total?current:{mime:frame.mime,name:frame.name,size:frame.size,hash:frame.hash,total:frame.total,chunks:{}};
  state.chunks[String(frame.index)]=frame.data; sessionStorage.setItem(key,JSON.stringify(state));
  return {...frame,received:Object.keys(state.chunks).length,complete:Object.keys(state.chunks).length===state.total};
}
export async function reconstructTransfer(session:string) {
  const key=`or-transfer-${session}`, raw=sessionStorage.getItem(key); if(!raw) return null;
  const state=JSON.parse(raw) as {mime:string;name:string;size:number;hash:string;total:number;chunks:Record<string,string>};
  for(let i=1;i<=state.total;i++) if(!state.chunks[String(i)]) return null;
  const encoded=Array.from({length:state.total},(_,i)=>state.chunks[String(i+1)]).join('');
  const bytes=fromBase64(encoded);
  if(bytes.byteLength!==state.size || await sha256(bytes)!==state.hash) throw new Error('Integrity verification failed. Rescan the missing frame(s).');
  sessionStorage.removeItem(key);
  return {url:URL.createObjectURL(new Blob([bytes],{type:state.mime})),name:state.name,size:state.size,mime:state.mime};
}

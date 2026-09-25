export const IMAGE_QR_PREFIX = 'ORIMG1:';
const MAX_PAYLOAD_CHARS = 2400;
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve,reject)=>{ const url=URL.createObjectURL(file); const img=new Image(); img.onload=()=>{URL.revokeObjectURL(url);resolve(img)}; img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Unable to read image.'))}; img.src=url; });
}
function render(img: HTMLImageElement, side: number, quality: number) {
  const scale=Math.min(1,side/Math.max(img.naturalWidth,img.naturalHeight)); const w=Math.max(1,Math.round(img.naturalWidth*scale)); const h=Math.max(1,Math.round(img.naturalHeight*scale)); const c=document.createElement('canvas'); c.width=w;c.height=h; const ctx=c.getContext('2d'); if(!ctx) throw new Error('Canvas unavailable.'); ctx.drawImage(img,0,0,w,h); return {dataUrl:c.toDataURL('image/jpeg',quality),width:w,height:h};
}
export async function encodeImageForQr(file: File) {
  if(!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if(file.size>15*1024*1024) throw new Error('Please choose an image smaller than 15 MB.');
  const img=await loadImage(file);
  for(const [side,quality] of [[240,.55],[220,.5],[200,.46],[180,.42],[160,.38]] as const){
    const r=render(img,side,quality); const payload=IMAGE_QR_PREFIX+r.dataUrl;
    if(payload.length<=MAX_PAYLOAD_CHARS) return {payload,previewUrl:r.dataUrl,width:r.width,height:r.height};
  }
  throw new Error('This photo is too detailed for one QR. Try a smaller or simpler image.');
}
export function isImageQr(value:string){return value.startsWith(IMAGE_QR_PREFIX)}
export function decodeImageQr(value:string){if(!isImageQr(value)) return null; const data=value.slice(IMAGE_QR_PREFIX.length); return data.startsWith('data:image/')?data:null}

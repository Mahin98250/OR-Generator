const MAGIC=0x4f50;
export const OPTIFRAME_SIZE=128;
export const OPTIFRAME_MAX_PAYLOAD=3900;
const HEADER_BITS=64, FINDER_SIZE=9, FINDER_OFFSET=4;
export type OptiFrame={version:number;sequence:number;total:number;payload:Uint8Array};

function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^(0xedb88320&-(crc&1));}return(crc^0xffffffff)>>>0;}
function writeBits(out:number[],value:number,count:number){for(let b=count-1;b>=0;b--)out.push((value>>>b)&1);}
function readBits(bits:number[],offset:number,count:number){let value=0;for(let i=0;i<count;i++)value=(value<<1)|bits[offset+i];return value>>>0;}
function bytesToBits(bytes:Uint8Array){const out:number[]=[];for(const byte of bytes)writeBits(out,byte,8);return out;}
function bitsToBytes(bits:number[]){const out=new Uint8Array(Math.floor(bits.length/8));for(let i=0;i<out.length;i++)out[i]=readBits(bits,i*8,8);return out;}
function finderBit(r:number,c:number){const edge=r===0||c===0||r===FINDER_SIZE-1||c===FINDER_SIZE-1;const ring=r===1||c===1||r===7||c===7;const center=r>=2&&r<=6&&c>=2&&c<=6;return edge||(center&&!ring);}
function zones(){return [[FINDER_OFFSET,FINDER_OFFSET],[OPTIFRAME_SIZE-FINDER_OFFSET-FINDER_SIZE,FINDER_OFFSET],[FINDER_OFFSET,OPTIFRAME_SIZE-FINDER_OFFSET-FINDER_SIZE],[OPTIFRAME_SIZE-FINDER_OFFSET-FINDER_SIZE,OPTIFRAME_SIZE-FINDER_OFFSET-FINDER_SIZE]] as const;}
function isFinderCell(r:number,c:number){return zones().some(([y,x])=>r>=y&&r<y+FINDER_SIZE&&c>=x&&c<x+FINDER_SIZE);}
function finderValue(r:number,c:number){for(const [y,x] of zones())if(r>=y&&r<y+FINDER_SIZE&&c>=x&&c<x+FINDER_SIZE)return finderBit(r-y,c-x)?3:0;return -1;}
function capacityBits(){let n=0;for(let r=0;r<OPTIFRAME_SIZE;r++)for(let c=0;c<OPTIFRAME_SIZE;c++)if(!isFinderCell(r,c))n+=2;return n-HEADER_BITS;}
export function getOptiFrameCapacity(){return Math.min(OPTIFRAME_MAX_PAYLOAD,Math.floor(capacityBits()/8)-4);}

export function encodeOptiFrame(payload:Uint8Array,sequence=0,total=1){
 if(payload.length>getOptiFrameCapacity())throw new Error('OptiFrame payload is too large.');
 if(!Number.isInteger(sequence)||sequence<0||sequence>65535||!Number.isInteger(total)||total<1||total>65535)throw new Error('OptiFrame metadata is out of range.');
 const header:number[]=[];writeBits(header,MAGIC,16);writeBits(header,1,4);writeBits(header,sequence,16);writeBits(header,total,16);writeBits(header,payload.length,12);
 const body=new Uint8Array(payload.length+4);body.set(payload);const crc=crc32(payload);body[payload.length]=crc>>>24;body[payload.length+1]=crc>>>16;body[payload.length+2]=crc>>>8;body[payload.length+3]=crc;
 const bits=[...header,...bytesToBits(body)],canvas=document.createElement('canvas');canvas.width=OPTIFRAME_SIZE;canvas.height=OPTIFRAME_SIZE;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable.');
 const image=ctx.createImageData(OPTIFRAME_SIZE,OPTIFRAME_SIZE);let cursor=0;
 for(let r=0;r<OPTIFRAME_SIZE;r++)for(let col=0;col<OPTIFRAME_SIZE;col++){const i=(r*OPTIFRAME_SIZE+col)*4;let level=finderValue(r,col);if(level<0){level=((bits[cursor]??0)<<1)|(bits[cursor+1]??0);cursor+=2;}const lum=[0,85,170,255][level];image.data[i]=lum;image.data[i+1]=lum;image.data[i+2]=lum;image.data[i+3]=255;}
 ctx.putImageData(image,0,0);return{canvas,frame:{version:1,sequence,total,payload} as OptiFrame};
}
function quantize(v:number){return v<43?0:v<128?1:v<213?2:3;}
export function decodeOptiFrame(source:CanvasImageSource|ImageData){
 const canvas=document.createElement('canvas');canvas.width=OPTIFRAME_SIZE;canvas.height=OPTIFRAME_SIZE;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
 if(source instanceof ImageData){if(source.width!==OPTIFRAME_SIZE||source.height!==OPTIFRAME_SIZE)return null;ctx.putImageData(source,0,0);}else ctx.drawImage(source,0,0,OPTIFRAME_SIZE,OPTIFRAME_SIZE);
 const image=ctx.getImageData(0,0,OPTIFRAME_SIZE,OPTIFRAME_SIZE),bits:number[]=[];
 for(let r=0;r<OPTIFRAME_SIZE;r++)for(let col=0;col<OPTIFRAME_SIZE;col++){if(isFinderCell(r,col))continue;const i=(r*OPTIFRAME_SIZE+col)*4;const level=quantize((image.data[i]+image.data[i+1]+image.data[i+2])/3);bits.push((level>>>1)&1,level&1);}
 if(bits.length<HEADER_BITS+32)return null;const magic=readBits(bits,0,16),version=readBits(bits,16,4),sequence=readBits(bits,20,16),total=readBits(bits,36,16),length=readBits(bits,52,12);
 if(magic!==MAGIC||version!==1||total<1||length>OPTIFRAME_MAX_PAYLOAD)return null;
 const byteBits=bits.slice(HEADER_BITS,HEADER_BITS+(length+4)*8);if(byteBits.length<(length+4)*8)return null;const bytes=bitsToBytes(byteBits),payload=bytes.slice(0,length);
 const expected=((bytes[length]<<24)|(bytes[length+1]<<16)|(bytes[length+2]<<8)|bytes[length+3])>>>0;if(crc32(payload)!==expected)return null;
 return{version,sequence,total,payload};
}
export function optiFrameSelfTest(){const payload=new TextEncoder().encode('OptiCode experimental optical frame');const encoded=encodeOptiFrame(payload,7,19);const decoded=decodeOptiFrame(encoded.canvas);if(!decoded||decoded.sequence!==7||decoded.total!==19||decoded.payload.some((v,i)=>v!==payload[i]))throw new Error('OptiFrame round trip failed.');return{payloadBytes:payload.length,capacityBytes:getOptiFrameCapacity()};}

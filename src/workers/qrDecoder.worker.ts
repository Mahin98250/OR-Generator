import jsQR from 'jsqr';

type DecodeRequest = {
  id:number;
  width:number;
  height:number;
  buffer:ArrayBuffer;
  maxDepth?:number;
};

type DecodeResult = {
  id:number;
  values:string[];
  regionsScanned:number;
  processingMs:number;
};

const seenGlobal = new Set<string>();

function keyFor(value:string) {
  return value.length > 180 ? value.slice(0,180) : value;
}

function scanRegion(
  data:Uint8ClampedArray,
  sourceWidth:number,
  sourceHeight:number,
  x:number,
  y:number,
  width:number,
  height:number,
) {
  const clippedWidth=Math.max(1,Math.min(width,sourceWidth-x));
  const clippedHeight=Math.max(1,Math.min(height,sourceHeight-y));
  const region=new Uint8ClampedArray(clippedWidth*clippedHeight*4);
  for(let row=0;row<clippedHeight;row+=1) {
    const from=((y+row)*sourceWidth+x)*4;
    region.set(data.subarray(from,from+clippedWidth*4),row*clippedWidth*4);
  }
  return {region,width:clippedWidth,height:clippedHeight};
}

function decode(request:DecodeRequest):DecodeResult {
  const started=performance.now();
  const values:string[]=[];
  const localSeen=new Set<string>();
  let regionsScanned=0;
  const data=new Uint8ClampedArray(request.buffer);
  const maxDepth=Math.max(1,Math.min(2,request.maxDepth ?? 2));

  const add=(value?:string) => {
    if(!value)return;
    const key=keyFor(value);
    if(localSeen.has(key))return;
    localSeen.add(key);
    values.push(value);
  };

  const inspect=(x:number,y:number,w:number,h:number) => {
    regionsScanned+=1;
    const {region,width,height}=scanRegion(data,request.width,request.height,x,y,w,h);
    if(width<120||height<120)return;
    try {
      add(jsQR(region,width,height,{inversionAttempts:'attemptBoth'})?.data);
    } catch {
      // A malformed region must not kill the frame.
    }
  };

  // First pass: full camera frame.
  inspect(0,0,request.width,request.height);

  // Second pass: overlapping 2x2 and 4x4 tiles. This turns the old
  // fixed-quadrant fallback into a general multi-code search that can find
  // several QR codes in arbitrary parts of the same camera frame.
  const tileGrids=maxDepth>=2 ? [2,4] : [2];
  for(const grid of tileGrids) {
    const stepX=request.width/grid;
    const stepY=request.height/grid;
    const overlapX=Math.floor(stepX*0.16);
    const overlapY=Math.floor(stepY*0.16);
    for(let row=0;row<grid;row+=1) {
      for(let col=0;col<grid;col+=1) {
        const x=Math.max(0,Math.floor(col*stepX-overlapX));
        const y=Math.max(0,Math.floor(row*stepY-overlapY));
        const right=Math.min(request.width,Math.ceil((col+1)*stepX+overlapX));
        const bottom=Math.min(request.height,Math.ceil((row+1)*stepY+overlapY));
        inspect(x,y,right-x,bottom-y);
      }
    }
  }

  const unique=[];
  for(const value of values) {
    const key=keyFor(value);
    if(seenGlobal.has(key))continue;
    seenGlobal.add(key);
    unique.push(value);
  }
  if(seenGlobal.size>4000) {
    const keep=[...seenGlobal].slice(-2500);
    seenGlobal.clear();
    keep.forEach(v=>seenGlobal.add(v));
  }

  return {id:request.id,values:unique,regionsScanned,processingMs:performance.now()-started};
}

self.onmessage=(event:MessageEvent<DecodeRequest>) => {
  try {
    const result=decode(event.data);
    (self as DedicatedWorkerGlobalScope).postMessage(result);
  } catch {
    (self as DedicatedWorkerGlobalScope).postMessage({
      id:event.data.id,values:[],regionsScanned:0,processingMs:0,
    } satisfies DecodeResult);
  }
};

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

const keyFor=(value:string)=>value.length>180?value.slice(0,180):value;

function scanRegion(data:Uint8ClampedArray,sourceWidth:number,sourceHeight:number,x:number,y:number,width:number,height:number){
  const clippedWidth=Math.max(1,Math.min(width,sourceWidth-x));
  const clippedHeight=Math.max(1,Math.min(height,sourceHeight-y));
  const region=new Uint8ClampedArray(clippedWidth*clippedHeight*4);
  for(let row=0;row<clippedHeight;row+=1){
    const from=((y+row)*sourceWidth+x)*4;
    region.set(data.subarray(from,from+clippedWidth*4),row*clippedWidth*4);
  }
  return {region,width:clippedWidth,height:clippedHeight};
}

function decode(request:DecodeRequest):DecodeResult{
  const started=performance.now();
  const values:string[]=[];
  const localSeen=new Set<string>();
  let regionsScanned=0;
  const data=new Uint8ClampedArray(request.buffer);
  // Keep the real-time path bounded. A 2x2 optical layout only needs the
  // full frame plus four overlapping quadrants; the old 4x4 pass multiplied
  // expensive jsQR work without adding useful coverage for our 1/2/4-lane UI.
  const maxDepth=Math.max(1,Math.min(1,request.maxDepth??1));

  const add=(value?:string)=>{
    if(!value)return;
    const key=keyFor(value);
    if(localSeen.has(key))return;
    localSeen.add(key);
    values.push(value);
  };

  const inspect=(x:number,y:number,w:number,h:number)=>{
    regionsScanned+=1;
    const {region,width,height}=scanRegion(data,request.width,request.height,x,y,w,h);
    if(width<120||height<120)return;
    try{
      // OptiCode always renders black modules on a white background. Avoid
      // jsQR's inverse-image pass; its own documentation notes that
      // `attemptBoth` costs roughly 50% extra decode work.
      add(jsQR(region,width,height,{inversionAttempts:'dontInvert',canOverwriteImage:true})?.data);
    }catch{}
  };

  // Whole-frame pass plus one overlapping 2x2 pass. Four quadrants map
  // directly to the sender's maximum four-lane layout, while the full-frame
  // pass keeps the one-lane case robust.
  inspect(0,0,request.width,request.height);
  const grids=maxDepth>=1?[2]:[];
  for(const grid of grids){
    const stepX=request.width/grid,stepY=request.height/grid;
    const overlapX=Math.floor(stepX*.16),overlapY=Math.floor(stepY*.16);
    for(let row=0;row<grid;row+=1){
      for(let col=0;col<grid;col+=1){
        const x=Math.max(0,Math.floor(col*stepX-overlapX));
        const y=Math.max(0,Math.floor(row*stepY-overlapY));
        const right=Math.min(request.width,Math.ceil((col+1)*stepX+overlapX));
        const bottom=Math.min(request.height,Math.ceil((row+1)*stepY+overlapY));
        inspect(x,y,right-x,bottom-y);
      }
    }
  }
  return {id:request.id,values,regionsScanned,processingMs:performance.now()-started};
}

type WorkerScope={onmessage:(event:MessageEvent<DecodeRequest>)=>void;postMessage:(message:DecodeResult)=>void};
const scope=self as unknown as WorkerScope;
scope.onmessage=(event)=>{
  try{scope.postMessage(decode(event.data));}
  catch{scope.postMessage({id:event.data.id,values:[],regionsScanned:0,processingMs:0});}
};

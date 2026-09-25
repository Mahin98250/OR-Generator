import { useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2, Download, FileUp, Gauge, LockKeyhole, Radio, ScanLine, ShieldCheck, TimerReset, WifiOff, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QrDecodePool } from '../../lib/qrDecodePool';
import { createBenchmarkStart, finishBenchmark, type OpticalBenchmark } from '../../lib/opticalBenchmark';
import { OR_TRANSFER_GRID_SIZE, addTransferFrame, createTransfer, isTransferFrame, parseTransferFrame, reconstructTransfer } from '../../lib/orTransfer';
import { drawQrGrid } from '../../lib/qrCanvas';
import { createFountainDecoder, createFountainTransfer, FOUNTAIN_BLOCK_BYTES, FOUNTAIN_GRID_SIZE, isFountainFrame, parseFountainFrame, type FountainDecoder, type FountainDroplet, type FountainPlan } from '../../lib/fountain';

type Detector = { detect:(source:HTMLVideoElement)=>Promise<Array<{rawValue?:string}>> };
type DetectorCtor = new (options?:{formats?:string[]}) => Detector;

type Result = { url:string; name:string; size:number };
type Progress = { mode:'fountain'|'compatibility'; session:string; name:string; received:number; total:number; duplicates:number };
type Telemetry = {
  startedAt:number|null;
  renderMs:number;
  renderCount:number;
  renderFps:number;
  detectedPerSecond:number;
  solvedPerSecond:number;
  goodputKbps:number;
  duplicates:number;
  decodeMs:number;
  scanDelayMs:number;
};

export function Transfer() {
  const [tab,setTab]=useState<'send'|'receive'>('send');
  const [mode,setMode]=useState<'fountain'|'compatibility'>('fountain');
  const [file,setFile]=useState<File|null>(null);
  const [fountain,setFountain]=useState<FountainPlan|null>(null);
  const [compat,setCompat]=useState<Awaited<ReturnType<typeof createTransfer>>|null>(null);
  const [group,setGroup]=useState(0);
  const [qr,setQr]=useState('');
  const [playing,setPlaying]=useState(false);
  const [intervalMs,setIntervalMs]=useState(100);
  const [error,setError]=useState('');
  const [receiving,setReceiving]=useState(false);
  const [progress,setProgress]=useState<Progress|null>(null);
  const [result,setResult]=useState<Result|null>(null);
  const [compatMissing,setCompatMissing]=useState<number|null>(null);
  const [autoTune,setAutoTune]=useState(true);
  const [benchmarking,setBenchmarking]=useState(false);
  const [benchmark,setBenchmark]=useState<OpticalBenchmark|null>(null);
  const [telemetry,setTelemetry]=useState<Telemetry>({startedAt:null,renderMs:0,renderCount:0,renderFps:0,detectedPerSecond:0,solvedPerSecond:0,goodputKbps:0,duplicates:0,decodeMs:0,scanDelayMs:55});
  const inputRef=useRef<HTMLInputElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const detectorRef=useRef<Detector|null>(null);
  const receivingRef=useRef(false);
  const fallbackCanvasRef=useRef<HTMLCanvasElement|null>(null);
  const qrPoolRef=useRef<QrDecodePool|null>(null);
  const timerRef=useRef<number|null>(null);
  const fountainDecoderRef=useRef<FountainDecoder|null>(null);
  const fountainMetaRef=useRef<FountainDroplet|null>(null);
  const recentRef=useRef<Map<string,number>>(new Map());
  const renderCountRef=useRef(0);
  const renderWindowRef=useRef({started:0,count:0});
  const receiverStartedRef=useRef<number|null>(null);
  const detectedWindowRef=useRef({started:0,count:0});
  const solvedRef=useRef(0);
  const decodedBytesRef=useRef(0);
  const duplicateCountRef=useRef(0);
  const lastTelemetryRef=useRef(0);
  const scanDelayRef=useRef(55);
  const benchmarkStartedRef=useRef<number|null>(null);
  const benchmarkFramesRef=useRef(0);
  const benchmarkCodesRef=useRef(0);
  const benchmarkUniqueRef=useRef(new Set<string>());
  const benchmarkDecodeSamplesRef=useRef<number[]>([]);

  useEffect(()=>()=>{ stopReceive(); stopPlayback(); if(result?.url) URL.revokeObjectURL(result.url); },[result]);
  useEffect(()=>{
    if(!playing) return;
    timerRef.current=window.setInterval(()=>setGroup(v=>v+1),intervalMs);
    return()=>{ if(timerRef.current!==null) window.clearInterval(timerRef.current); timerRef.current=null; };
  },[playing,intervalMs]);

  useEffect(()=>{
    let cancelled=false;
    const plan=fountain ?? compat;
    if(!plan){ setQr(''); return; }
    const grid=fountain ? FOUNTAIN_GRID_SIZE : OR_TRANSFER_GRID_SIZE;
    const totalGroups=fountain ? Math.max(1,Math.ceil(fountain.recommended/grid)) : Math.max(1,Math.ceil((compat?.total ?? 1)/grid));
    const current=group%totalGroups;
    void (async()=>{
      try{
        const renderStart=performance.now();
        const values:string[]=[];
        for(let lane=0;lane<grid;lane+=1){
          if(fountain) values.push(await fountain.getDroplet(lane, group));
          else{
            const index=current*grid+lane+1;
            if(compat && index<=compat.total) values.push(await compat.getFrame(index));
          }
        }
        if(cancelled)return;
        renderCountRef.current+=1;
        const image=drawQrGrid(values,900,14);
        const renderMs=performance.now()-renderStart;
        if(renderWindowRef.current.started===0)renderWindowRef.current.started=performance.now();
        renderWindowRef.current.count+=1;
        setQr(image);
        if(autoTune && fountain){
          const now=performance.now();
          const windowMs=now-renderWindowRef.current.started;
          if(windowMs>=1500){
            const fps=renderWindowRef.current.count/(windowMs/1000);
            const avg=(renderMs+telemetry.renderMs)/2;
            if(avg<18 && fps>8 && intervalMs>50)setIntervalMs(v=>Math.max(50,v-10));
            else if(avg>45 && intervalMs<300)setIntervalMs(v=>Math.min(300,v+20));
            renderWindowRef.current={started:now,count:0};
          }
        }
        setTelemetry(prev=>({...prev,renderMs:prev.renderCount===0?renderMs:(prev.renderMs*0.75+renderMs*0.25),renderCount:renderCountRef.current,renderFps:prev.renderFps===0?1/(Math.max(.001,renderMs)/1000):prev.renderFps*.8+(1/Math.max(.001,renderMs/1000))*.2}));
      }catch(e){
        if(!cancelled)setError(e instanceof Error?e.message:'Unable to render the transfer stream.');
      }
    })();
    return()=>{cancelled=true;};
  },[fountain,compat,group,autoTune,intervalMs]);

  function stopPlayback(){ setPlaying(false); if(timerRef.current!==null){window.clearInterval(timerRef.current);timerRef.current=null;} }
  function stopReceive(){
    receivingRef.current=false; detectorRef.current=null; streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null;
    qrPoolRef.current?.terminate(); qrPoolRef.current=null;
    setReceiving(false);
  }
  function resetDecoder(){ fountainDecoderRef.current=null; fountainMetaRef.current=null; recentRef.current.clear(); }

  async function choose(value?:File){
    if(!value)return;
    setError(''); setResult(null); stopPlayback(); setGroup(0); resetDecoder(); receiverStartedRef.current=null; solvedRef.current=0; decodedBytesRef.current=0; duplicateCountRef.current=0; detectedWindowRef.current={started:0,count:0}; renderWindowRef.current={started:0,count:0};
    try{
      if(mode==='fountain'){
        const plan=await createFountainTransfer(value); setFountain(plan); setCompat(null);
      }else{
        const plan=await createTransfer(value); setCompat(plan); setFountain(null);
      }
      setFile(value);
    }catch(e){setFile(null);setFountain(null);setCompat(null);setQr('');setError(e instanceof Error?e.message:'Unable to prepare this file.');}
  }

  function recordBenchmark(codes:string[],decodeMs=0){
    if(!benchmarking)return;
    benchmarkFramesRef.current+=1;
    benchmarkCodesRef.current+=codes.length;
    for(const value of codes)benchmarkUniqueRef.current.add(value);
    if(decodeMs>0)benchmarkDecodeSamplesRef.current.push(decodeMs);
    const started=benchmarkStartedRef.current;
    if(started!==null && performance.now()-started>=10000){
      const completed=finishBenchmark(started,benchmarkFramesRef.current,benchmarkCodesRef.current,benchmarkUniqueRef.current.size,benchmarkDecodeSamplesRef.current,decodedBytesRef.current);
      setBenchmark(completed);
      setBenchmarking(false);
      benchmarkStartedRef.current=null;
    }
  }

  function startBenchmark(){
    if(!receiving)return;
    benchmarkFramesRef.current=0; benchmarkCodesRef.current=0; benchmarkUniqueRef.current.clear(); benchmarkDecodeSamplesRef.current=[];
    benchmarkStartedRef.current=createBenchmarkStart(); setBenchmark(null); setBenchmarking(true);
  }

  function acceptValue(value:string){
    const now=performance.now(), previous=recentRef.current.get(value);
    if(previous!==undefined && now-previous<250)return false;
    recentRef.current.set(value,now);
    if(recentRef.current.size>800){
      for(const [key,t] of recentRef.current) if(now-t>5000) recentRef.current.delete(key);
    }
    return true;
  }

  async function processValue(value:string){
    if(!acceptValue(value))return;
    if(isFountainFrame(value)){
      const frame=parseFountainFrame(value); if(!frame)return;
      if(!fountainDecoderRef.current){
        fountainMetaRef.current=frame;
        fountainDecoderRef.current=createFountainDecoder(frame);
      }
      const d=fountainDecoderRef.current.add(frame);
      if(d.duplicate)duplicateCountRef.current+=1;
      solvedRef.current=d.solved;
      decodedBytesRef.current=Math.min(frame.size,d.solved*frame.blockBytes);
      setProgress({mode:'fountain',session:frame.session,name:frame.name,received:d.solved,total:frame.blocks,duplicates:duplicateCountRef.current});
      if(d.complete){
        const rebuilt=await fountainDecoderRef.current.reconstruct();
        if(rebuilt){
          const url=URL.createObjectURL(new Blob([rebuilt.bytes.buffer as ArrayBuffer],{type:frame.mime}));
          setResult({url,name:frame.name,size:frame.size}); setProgress(null); stopReceive();
        }
      }
      return;
    }
    if(isTransferFrame(value)){
      const frame=parseTransferFrame(value); if(!frame)return;
      const added=await addTransferFrame(frame);
      if(added.duplicate)duplicateCountRef.current+=1;
      decodedBytesRef.current=Math.min(frame.size,Math.round((added.received/added.total)*frame.size));
      setProgress(prev=>({mode:'compatibility',session:frame.session,name:frame.name,received:added.received,total:added.total,duplicates:duplicateCountRef.current}));
      if(added.complete){
        const rebuilt=await reconstructTransfer(frame.session);
        if(rebuilt){setResult({url:rebuilt.url,name:rebuilt.name,size:rebuilt.size});setProgress(null);stopReceive();}
      }
    }
  }

  async function consumeDetected(found:Array<{rawValue?:string}>,decodeMs:number){
    const values=found.map(item=>item.rawValue).filter((value):value is string=>Boolean(value));
    recordBenchmark(values,decodeMs);
    await Promise.all(values.map(value=>processValue(value)));
    return values.length;
  }

  async function scanLoop(){
    if(!receivingRef.current||!videoRef.current||!detectorRef.current)return;
    const started=performance.now();
    let foundCount=0;
    try{
      const found=await detectorRef.current.detect(videoRef.current);
      foundCount=found.length;
      await consumeDetected(found,performance.now()-started);
    }catch{}
    const decodeMs=performance.now()-started;
    const now=performance.now();
    if(receiverStartedRef.current===null)receiverStartedRef.current=started;
    if(detectedWindowRef.current.started===0)detectedWindowRef.current.started=now;
    detectedWindowRef.current.count+=foundCount;
    const windowMs=now-detectedWindowRef.current.started;
    if(windowMs>=500){
      const seconds=windowMs/1000;
      const detectedPerSecond=detectedWindowRef.current.count/seconds;
      const elapsed=Math.max(0.001,(now-(receiverStartedRef.current ?? now))/1000);
      const solvedPerSecond=solvedRef.current/elapsed;
      const goodputKbps=(decodedBytesRef.current/1024)/elapsed;
      setTelemetry(prev=>({...prev,startedAt:receiverStartedRef.current,detectedPerSecond,solvedPerSecond,goodputKbps,duplicates:duplicateCountRef.current,decodeMs:prev.decodeMs===0?decodeMs:prev.decodeMs*0.7+decodeMs*0.3,scanDelayMs:scanDelayRef.current}));
      detectedWindowRef.current={started:now,count:0};
    }
    if(decodeMs>60)scanDelayRef.current=Math.min(140,Math.max(scanDelayRef.current,Math.round(decodeMs*0.9)));
    else if(foundCount>0)scanDelayRef.current=Math.max(20,scanDelayRef.current-5);
    else scanDelayRef.current=Math.min(80,scanDelayRef.current+2);
    if(receivingRef.current)window.setTimeout(()=>void scanLoop(),scanDelayRef.current);
  }

  async function startReceive(){
    setError('');setResult(null);setProgress(null);resetDecoder(); receiverStartedRef.current=null; solvedRef.current=0; duplicateCountRef.current=0; detectedWindowRef.current={started:0,count:0}; scanDelayRef.current=55; setTelemetry(prev=>({...prev,startedAt:null,detectedPerSecond:0,solvedPerSecond:0,goodputKbps:0,duplicates:0,scanDelayMs:55}));
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      streamRef.current=stream;receivingRef.current=true;setReceiving(true);
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      if('BarcodeDetector' in window){
        const Ctor=(window as unknown as {BarcodeDetector:DetectorCtor}).BarcodeDetector;
        detectorRef.current=new Ctor({formats:['qr_code']}); void scanLoop();
      }else{
        const canvas=document.createElement('canvas'); fallbackCanvasRef.current=canvas;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        qrPoolRef.current=new QrDecodePool();
        const loop=async()=>{
          if(!receivingRef.current||!videoRef.current||!ctx||!qrPoolRef.current)return;
          const video=videoRef.current,w=video.videoWidth,h=video.videoHeight;
          if(w&&h){
            canvas.width=w; canvas.height=h;
            ctx.drawImage(video,0,0,w,h);
            const image=ctx.getImageData(0,0,w,h);
            const pool=qrPoolRef.current;
            const maxDepth=telemetry.decodeMs>75?1:2;
            const job=pool.decode(image.data.buffer,w,h,maxDepth);
            if(job){
              try{
                const decoded=await job;
                recordBenchmark(decoded.values,decoded.processingMs);
                await Promise.all(decoded.values.map(value=>processValue(value)));
                const decodeMs=decoded.processingMs;
                setTelemetry(prev=>({...prev,decodeMs:prev.decodeMs===0?decodeMs:prev.decodeMs*.7+decodeMs*.3,detectedPerSecond:decoded.values.length>0?prev.detectedPerSecond:prev.detectedPerSecond}));
                scanDelayRef.current=decodeMs>75?Math.min(180,Math.max(70,Math.round(decodeMs*.9))):decoded.values.length>0?Math.max(25,scanDelayRef.current-4):Math.min(85,scanDelayRef.current+2);
              }catch(e){setError(e instanceof Error?e.message:'QR decoder worker failed.');}
            }
          }
          if(receivingRef.current)window.setTimeout(()=>void loop(),scanDelayRef.current);
        };
        void loop();
      }
    }catch(e){setError(e instanceof Error?e.message:'Camera permission was denied.');}
  }

  return <section className="mx-auto max-w-6xl py-8 sm:py-12">
    <Link to="/" className="text-xs font-semibold text-[var(--text-muted)]">Back home</Link>
    <div className="mt-5 overflow-hidden rounded-[32px] border border-cyan-300/15 bg-[var(--bg-elevated)] p-6 shadow-glass backdrop-blur-2xl sm:p-9">
      <div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-cyan-200"><Radio size={14}/> OR Transfer 2.0</span><span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"><WifiOff size={14}/> Offline optical</span></div>
      <h1 className="mt-5 text-4xl font-black tracking-[-.045em] sm:text-6xl">Fast file transfer <span className="text-gradient">without internet.</span></h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">Four optical lanes + fountain recovery. Dropped, duplicated and out-of-order QR frames are expected; the receiver reconstructs the original bytes and verifies SHA-256.</p>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-1">
      <button onClick={()=>{stopReceive();setTab('send')}} className={`rounded-xl px-4 py-3 text-sm font-bold ${tab==='send'?'bg-white text-slate-950':'text-[var(--text-muted)]'}`}><FileUp size={15} className="mr-2 inline"/>Send</button>
      <button onClick={()=>setTab('receive')} className={`rounded-xl px-4 py-3 text-sm font-bold ${tab==='receive'?'bg-white text-slate-950':'text-[var(--text-muted)]'}`}><ScanLine size={15} className="mr-2 inline"/>Receive</button>
    </div>

    {tab==='send' ? <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <div className="glass-panel rounded-[28px] p-5">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
          <button onClick={()=>{stopPlayback();setMode('fountain');setFountain(null);setCompat(null);setFile(null);}} className={`rounded-xl px-3 py-3 text-xs font-bold ${mode==='fountain'?'bg-cyan-300 text-slate-950':'text-[var(--text-muted)]'}`}>Fountain speed</button>
          <button onClick={()=>{stopPlayback();setMode('compatibility');setFountain(null);setCompat(null);setFile(null);}} className={`rounded-xl px-3 py-3 text-xs font-bold ${mode==='compatibility'?'bg-white text-slate-950':'text-[var(--text-muted)]'}`}>Compatibility</button>
        </div>
        <input ref={inputRef} type="file" className="sr-only" onChange={e=>{void choose(e.target.files?.[0]);e.currentTarget.value='';}}/>
        <button onClick={()=>inputRef.current?.click()} className="mt-4 w-full rounded-[24px] border border-dashed border-cyan-300/30 bg-cyan-300/[.05] p-8 text-center"><FileUp className="mx-auto text-cyan-300" size={30}/><p className="mt-3 font-bold">Choose any file</p><p className="mt-1 text-xs text-[var(--text-muted)]">{mode==='fountain'?'Up to 64 MB · fountain recovery':'Up to 100 MB · exact sequential recovery'}</p></button>
        {file&&<div className="mt-4 rounded-2xl bg-white/5 p-4"><p className="truncate font-bold">{file.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{(file.size/1024/1024).toFixed(2)} MB · {mode==='fountain'?`${fountain?.blocks.toLocaleString()} source blocks`:`${compat?.total.toLocaleString()} QR frames`}</p></div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/5 p-4"><Gauge size={18} className="text-cyan-300"/><p className="mt-2 text-sm font-bold">High-speed stream</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Four independent QR lanes, adaptive playback and continuous recovery.</p></div>
          <div className="rounded-2xl bg-white/5 p-4"><ShieldCheck size={18} className="text-emerald-300"/><p className="mt-2 text-sm font-bold">Integrity verified</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">The completed file must match the original SHA-256 hash.</p></div>
        </div>
      </div>
      <div className="glass-panel rounded-[28px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300">Live optical stream</p><p className="mt-1 text-sm text-[var(--text-muted)]">{fountain?'Fountain droplets · systematic + random recovery lanes':compat?'Sequential compatibility stream':'Choose a file to begin'}</p></div>{(fountain||compat)&&<button onClick={()=>setPlaying(v=>!v)} className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950">{playing?'Pause':'Start stream'}</button>}</div>
        {qr?<img src={qr} alt="OR Transfer QR stream" className="mx-auto mt-5 aspect-square w-full max-w-[620px] rounded-2xl bg-white p-2"/>:<div className="mt-5 grid aspect-square place-items-center rounded-2xl bg-black/20 text-sm text-[var(--text-muted)]">QR stream preview</div>}
        {(fountain||compat)&&<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="rounded-xl bg-white/5 p-3 text-xs font-bold">Auto tune<select value={autoTune?'on':'off'} onChange={e=>setAutoTune(e.target.value==='on')} className="mt-2 w-full rounded-lg bg-black/20 p-2 text-xs"><option value="on">On · render-safe</option><option value="off">Off · manual</option></select></label><label className="rounded-xl bg-white/5 p-3 text-xs font-bold">Speed<select value={intervalMs} onChange={e=>setIntervalMs(Number(e.target.value))} className="mt-2 w-full rounded-lg bg-black/20 p-2 text-xs"><option value="60">60 ms · extreme</option><option value="80">80 ms · very fast</option><option value="100">100 ms · recommended</option><option value="150">150 ms · safe</option><option value="250">250 ms · compatibility</option></select></label><div className="rounded-xl bg-white/5 p-3 text-xs"><b>Render</b><p className="mt-1 text-[var(--text-muted)]">{telemetry.renderMs.toFixed(1)} ms · {intervalMs?Math.round(1000/intervalMs):0} FPS target</p></div><div className="rounded-xl bg-white/5 p-3 text-xs"><b>Payload</b><p className="mt-1 text-[var(--text-muted)]">{fountain?FOUNTAIN_BLOCK_BYTES+' bytes/block':'~1875 bytes/frame'}</p></div><div className="rounded-xl bg-white/5 p-3 text-xs"><b>Lanes</b><p className="mt-1 text-[var(--text-muted)]">4 QR codes</p></div><div className="rounded-xl bg-white/5 p-3 text-xs"><b>Recovery</b><p className="mt-1 text-[var(--text-muted)]">{fountain?'Fountain':'Sequential'}</p></div></div>}
      </div>
    </div> : <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <div className="glass-panel overflow-hidden rounded-[28px] p-4"><video ref={videoRef} muted playsInline className="aspect-video w-full rounded-2xl bg-black object-cover"/><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>{if(receiving)stopReceive();else void startReceive();}} className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">{receiving?'Stop receiver':'Start receiver'}</button><span className="rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">{receiving?'Scanning multi-QR':'Camera idle'}</span>{receiving&&<button onClick={startBenchmark} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-200">{benchmarking?'Benchmarking…':'10s benchmark'}</button>}</div></div>
      <div className="glass-panel rounded-[28px] p-5"><LockKeyhole size={20} className="text-cyan-300"/><p className="mt-3 font-bold">Loss-tolerant receiver</p><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Start the receiver before or after the sender. Fountain mode does not require frame 1, frame 2, frame 3… in order.</p><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl bg-cyan-300/[.06] p-3"><Activity size={16} className="text-cyan-300"/><p className="mt-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Decode</p><p className="mt-1 text-sm font-black">{telemetry.detectedPerSecond.toFixed(1)}/s</p></div>
          <div className="rounded-2xl bg-cyan-300/[.06] p-3"><Zap size={16} className="text-cyan-300"/><p className="mt-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Goodput</p><p className="mt-1 text-sm font-black">{telemetry.goodputKbps.toFixed(1)} KB/s</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{(telemetry.goodputKbps/1024).toFixed(2)} MB/s</p></div>
          <div className="rounded-2xl bg-white/5 p-3"><TimerReset size={16} className="text-white/70"/><p className="mt-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Detector</p><p className="mt-1 text-sm font-black">{telemetry.decodeMs.toFixed(0)} ms</p></div>
          <div className="rounded-2xl bg-white/5 p-3"><Gauge size={16} className="text-white/70"/><p className="mt-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Scan cadence</p><p className="mt-1 text-sm font-black">{Math.round(telemetry.scanDelayMs)} ms</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{telemetry.duplicates} duplicates</p></div>
        </div>
        {benchmark&&<div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.05] p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[.14em] text-cyan-200">Benchmark result</p><span className="text-[10px] text-[var(--text-muted)]">{(benchmark.durationMs/1000).toFixed(1)} s</span></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><div><p className="text-[10px] text-[var(--text-muted)]">Codes/sec</p><p className="text-sm font-black">{benchmark.peakDecodeRate.toFixed(1)}</p></div><div><p className="text-[10px] text-[var(--text-muted)]">Codes/frame</p><p className="text-sm font-black">{benchmark.averageCodesPerFrame.toFixed(2)}</p></div><div><p className="text-[10px] text-[var(--text-muted)]">Unique</p><p className="text-sm font-black">{benchmark.uniqueCodes}</p></div><div><p className="text-[10px] text-[var(--text-muted)]">Goodput</p><p className="text-sm font-black">{benchmark.goodputKbps.toFixed(1)} KB/s</p></div></div><p className="mt-3 text-[10px] leading-5 text-[var(--text-muted)]">Physical benchmark: point the receiver at the sender's QR stream during the 10-second measurement window.</p></div>}{progress&&<div className="mt-5 rounded-2xl bg-white/5 p-4"><p className="truncate text-sm font-bold">{progress.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{progress.mode==='fountain'?`${progress.received.toLocaleString()} unique droplets · ${progress.total.toLocaleString()} source blocks`:`${progress.received} / ${progress.total} frames`}</p><div className="mt-3 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{width:`${Math.min(100,Math.round(progress.received/progress.total*100))}%`}}/></div></div>}{result&&<div className="mt-5 rounded-2xl bg-emerald-400/10 p-4"><CheckCircle2 className="text-emerald-300"/><p className="mt-2 font-bold">File reconstructed & verified</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{result.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{(result.size/1024/1024).toFixed(2)} MB · SHA-256 verified</p><a href={result.url} download={result.name} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950"><Download size={14}/> Save file</a></div>}{error&&<p className="mt-5 rounded-2xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}</div>
    </div>}
    <div className="mt-5 grid gap-3 md:grid-cols-3">{[['01','Encode','The file becomes source blocks and optical droplets.'],['02','Stream','Four QR lanes continuously send different information.'],['03','Recover','Missing frames are tolerated and SHA-256 verifies the result.']].map(([n,t,d])=><div key={n} className="glass-panel rounded-[24px] p-5"><span className="text-xs font-black text-cyan-300">{n}</span><h2 className="mt-2 font-bold">{t}</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{d}</p></div>)}</div>
  </section>;
}

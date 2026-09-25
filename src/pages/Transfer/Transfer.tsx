import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileUp, Gauge, LockKeyhole, Radio, ScanLine, ShieldCheck, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import jsQR from 'jsqr';
import { OR_TRANSFER_GRID_SIZE, addTransferFrame, createTransfer, isTransferFrame, parseTransferFrame, reconstructTransfer } from '../../lib/orTransfer';
import { drawQrGrid } from '../../lib/qrCanvas';
import { createFountainDecoder, createFountainTransfer, FOUNTAIN_BLOCK_BYTES, FOUNTAIN_GRID_SIZE, isFountainFrame, parseFountainFrame, type FountainDecoder, type FountainDroplet, type FountainPlan } from '../../lib/fountain';

type Detector = { detect:(source:HTMLVideoElement)=>Promise<Array<{rawValue?:string}>> };
type DetectorCtor = new (options?:{formats?:string[]}) => Detector;

type Result = { url:string; name:string; size:number };
type Progress = { mode:'fountain'|'compatibility'; session:string; name:string; received:number; total:number; duplicates:number };

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
  const inputRef=useRef<HTMLInputElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const detectorRef=useRef<Detector|null>(null);
  const receivingRef=useRef(false);
  const fallbackCanvasRef=useRef<HTMLCanvasElement|null>(null);
  const timerRef=useRef<number|null>(null);
  const fountainDecoderRef=useRef<FountainDecoder|null>(null);
  const fountainMetaRef=useRef<FountainDroplet|null>(null);
  const recentRef=useRef<Map<string,number>>(new Map());

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
        const values:string[]=[];
        for(let lane=0;lane<grid;lane+=1){
          if(fountain) values.push(await fountain.getDroplet(lane, group));
          else{
            const index=current*grid+lane+1;
            if(compat && index<=compat.total) values.push(await compat.getFrame(index));
          }
        }
        if(cancelled)return;
        setQr(drawQrGrid(values,900,14));
      }catch(e){
        if(!cancelled)setError(e instanceof Error?e.message:'Unable to render the transfer stream.');
      }
    })();
    return()=>{cancelled=true;};
  },[fountain,compat,group]);

  function stopPlayback(){ setPlaying(false); if(timerRef.current!==null){window.clearInterval(timerRef.current);timerRef.current=null;} }
  function stopReceive(){
    receivingRef.current=false; detectorRef.current=null; streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null; setReceiving(false);
  }
  function resetDecoder(){ fountainDecoderRef.current=null; fountainMetaRef.current=null; recentRef.current.clear(); }

  async function choose(value?:File){
    if(!value)return;
    setError(''); setResult(null); stopPlayback(); setGroup(0); resetDecoder();
    try{
      if(mode==='fountain'){
        const plan=await createFountainTransfer(value); setFountain(plan); setCompat(null);
      }else{
        const plan=await createTransfer(value); setCompat(plan); setFountain(null);
      }
      setFile(value);
    }catch(e){setFile(null);setFountain(null);setCompat(null);setQr('');setError(e instanceof Error?e.message:'Unable to prepare this file.');}
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
      setProgress({mode:'fountain',session:frame.session,name:frame.name,received:fountainDecoderRef.current.seen(),total:frame.blocks,duplicates:0});
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
      setProgress(prev=>({mode:'compatibility',session:frame.session,name:frame.name,received:added.received,total:added.total,duplicates:(prev?.session===frame.session?prev.duplicates:0)+(added.duplicate?1:0)}));
      if(added.complete){
        const rebuilt=await reconstructTransfer(frame.session);
        if(rebuilt){setResult({url:rebuilt.url,name:rebuilt.name,size:rebuilt.size});setProgress(null);stopReceive();}
      }
    }
  }

  async function scanLoop(){
    if(!receivingRef.current||!videoRef.current||!detectorRef.current)return;
    try{
      const found=await detectorRef.current.detect(videoRef.current);
      await Promise.all(found.map(item=>item.rawValue?processValue(item.rawValue):Promise.resolve()));
    }catch{}
    if(receivingRef.current)window.setTimeout(()=>void scanLoop(),55);
  }

  async function startReceive(){
    setError('');setResult(null);setProgress(null);resetDecoder();
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
        const loop=async()=>{
          if(!receivingRef.current||!videoRef.current||!ctx)return;
          const video=videoRef.current,w=video.videoWidth,h=video.videoHeight;
          if(w&&h){
            const hw=Math.floor(w/2),hh=Math.floor(h/2);canvas.width=hw;canvas.height=hh;
            for(const [x,y] of [[0,0],[hw,0],[0,hh],[hw,hh]] as const){
              ctx.drawImage(video,x,y,hw,hh,0,0,hw,hh);
              const image=ctx.getImageData(0,0,hw,hh);
              const decoded=jsQR(image.data,hw,hh,{inversionAttempts:'dontInvert'});
              if(decoded?.data)try{await processValue(decoded.data);}catch(e){setError(e instanceof Error?e.message:'Transfer decode failed.');}
              if(!receivingRef.current)return;
            }
          }
          if(receivingRef.current)window.setTimeout(()=>void loop(),55);
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
        {(fountain||compat)&&<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><label className="rounded-xl bg-white/5 p-3 text-xs font-bold">Speed<select value={intervalMs} onChange={e=>setIntervalMs(Number(e.target.value))} className="mt-2 w-full rounded-lg bg-black/20 p-2 text-xs"><option value="60">60 ms · extreme</option><option value="80">80 ms · very fast</option><option value="100">100 ms · recommended</option><option value="150">150 ms · safe</option><option value="250">250 ms · compatibility</option></select></label><div className="rounded-xl bg-white/5 p-3 text-xs"><b>Payload</b><p className="mt-1 text-[var(--text-muted)]">{fountain?FOUNTAIN_BLOCK_BYTES+' bytes/block':'~1875 bytes/frame'}</p></div><div className="rounded-xl bg-white/5 p-3 text-xs"><b>Lanes</b><p className="mt-1 text-[var(--text-muted)]">4 QR codes</p></div><div className="rounded-xl bg-white/5 p-3 text-xs"><b>Recovery</b><p className="mt-1 text-[var(--text-muted)]">{fountain?'Fountain':'Sequential'}</p></div></div>}
      </div>
    </div> : <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <div className="glass-panel overflow-hidden rounded-[28px] p-4"><video ref={videoRef} muted playsInline className="aspect-video w-full rounded-2xl bg-black object-cover"/><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>{if(receiving)stopReceive();else void startReceive();}} className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">{receiving?'Stop receiver':'Start receiver'}</button><span className="rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">{receiving?'Scanning 4 QR lanes':'Camera idle'}</span></div></div>
      <div className="glass-panel rounded-[28px] p-5"><LockKeyhole size={20} className="text-cyan-300"/><p className="mt-3 font-bold">Loss-tolerant receiver</p><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Start the receiver before or after the sender. Fountain mode does not require frame 1, frame 2, frame 3… in order.</p>{progress&&<div className="mt-5 rounded-2xl bg-white/5 p-4"><p className="truncate text-sm font-bold">{progress.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{progress.mode==='fountain'?`${progress.received.toLocaleString()} unique droplets · ${progress.total.toLocaleString()} source blocks`:`${progress.received} / ${progress.total} frames`}</p><div className="mt-3 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{width:`${Math.min(100,Math.round(progress.received/progress.total*100))}%`}}/></div></div>}{result&&<div className="mt-5 rounded-2xl bg-emerald-400/10 p-4"><CheckCircle2 className="text-emerald-300"/><p className="mt-2 font-bold">File reconstructed & verified</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{result.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{(result.size/1024/1024).toFixed(2)} MB · SHA-256 verified</p><a href={result.url} download={result.name} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950"><Download size={14}/> Save file</a></div>}{error&&<p className="mt-5 rounded-2xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}</div>
    </div>}
    <div className="mt-5 grid gap-3 md:grid-cols-3">{[['01','Encode','The file becomes source blocks and optical droplets.'],['02','Stream','Four QR lanes continuously send different information.'],['03','Recover','Missing frames are tolerated and SHA-256 verifies the result.']].map(([n,t,d])=><div key={n} className="glass-panel rounded-[24px] p-5"><span className="text-xs font-black text-cyan-300">{n}</span><h2 className="mt-2 font-bold">{t}</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{d}</p></div>)}</div>
  </section>;
}

import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, LockKeyhole, Radio, ScanLine, ShieldCheck, WifiOff } from 'lucide-react';
import QRCode from 'qrcode';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Link } from 'react-router-dom';
import { addTransferFrame, clearTransfer, createTransfer, getTransferMissingFrames, isTransferFrame, parseTransferFrame, reconstructTransfer } from '../../lib/orTransfer';

type Detector = { detect:(source:HTMLVideoElement)=>Promise<Array<{rawValue?:string}>> };
type DetectorCtor = new (options?:{formats?:string[]}) => Detector;

export function Transfer() {
  const [tab,setTab]=useState<'send'|'receive'>('send');
  const [file,setFile]=useState<File|null>(null);
  const [plan,setPlan]=useState<Awaited<ReturnType<typeof createTransfer>>|null>(null);
  const [index,setIndex]=useState(0);
  const [qr,setQr]=useState('');
  const [error,setError]=useState('');
  const [receiving,setReceiving]=useState(false);
  const [playing,setPlaying]=useState(false);
  const [intervalMs,setIntervalMs]=useState(1000);
  const [progress,setProgress]=useState<{session:string;received:number;total:number;name:string;missingCount:number;missing:number[]|null;duplicates:number}|null>(null);
  const [result,setResult]=useState<{url:string;name:string;size:number}|null>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const receivingRef=useRef(false);
  const detectorRef=useRef<Detector|null>(null);
  const zxingRef=useRef<BrowserMultiFormatReader|null>(null);
  const zxingControlsRef=useRef<{stop:()=>void}|null>(null);
  const playTimerRef=useRef<number|null>(null);
  const playerRef=useRef<HTMLDivElement>(null);
  const [fullscreen,setFullscreen]=useState(false);

  useEffect(()=>{
    if(!plan){
      setQr('');
      return;
    }

    let cancelled=false;
    void plan.getFrame(index+1)
      .then(frame=>QRCode.toDataURL(frame,{width:900,margin:3,errorCorrectionLevel:'M'}))
      .then((value:string)=>{if(!cancelled)setQr(value);})
      .catch(()=>{if(!cancelled)setError('Unable to render transfer QR.');});

    return()=>{cancelled=true;};
  },[plan,index]);
  useEffect(()=>()=>{ stopReceive(); stopPlayback(); },[]);
  useEffect(()=>{ const onFullscreen=()=>setFullscreen(document.fullscreenElement===playerRef.current); document.addEventListener('fullscreenchange',onFullscreen); return()=>document.removeEventListener('fullscreenchange',onFullscreen); },[]);
  useEffect(()=>{
    if(!playing || !plan || plan.total < 2) return;
    playTimerRef.current = window.setInterval(()=>setIndex(i=>(i+1)%plan.total), intervalMs);
    return ()=>{ if(playTimerRef.current!==null) window.clearInterval(playTimerRef.current); playTimerRef.current=null; };
  },[playing,plan,intervalMs]);

  async function scanLoop() {
    if(!receivingRef.current||!videoRef.current||!detectorRef.current)return;
    try {
      const found=await detectorRef.current.detect(videoRef.current);
      for(const item of found) {
        const value=item.rawValue||''; if(!isTransferFrame(value))continue;
        const frame=parseTransferFrame(value); if(!frame)continue;
        const added=await addTransferFrame(frame);
        setProgress(prev => ({
          session:added.session,
          received:added.received,
          total:added.total,
          name:added.name,
          missingCount:added.missingCount,
          missing:null,
          duplicates:(prev?.session===added.session ? prev.duplicates : 0) + (added.duplicate ? 1 : 0),
        }));
        if(added.complete) {
          try {
            const rebuilt=await reconstructTransfer(added.session);
            if(rebuilt){
              setResult({url:rebuilt.url,name:rebuilt.name,size:rebuilt.size});
              setProgress(null);
              stopReceive();
              return;
            }
          } catch(e) {
            setError(e instanceof Error?e.message:'Transfer verification failed.');
          }
        }
      }
    } catch {}
    if(receivingRef.current) window.setTimeout(()=>void scanLoop(),90);
  }

  async function startReceive() {
    setError(''); setResult(null); setProgress(null);
    try {
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      streamRef.current=stream; receivingRef.current=true; setReceiving(true);
      if(videoRef.current){videoRef.current.srcObject=stream; await videoRef.current.play();}
      if('BarcodeDetector' in window) {
        const Ctor=(window as unknown as {BarcodeDetector:DetectorCtor}).BarcodeDetector;
        detectorRef.current=new Ctor({formats:['qr_code']});
        void scanLoop();
      } else {
        const reader=new BrowserMultiFormatReader();
        zxingRef.current=reader;
        const controls=await reader.decodeFromVideoDevice(undefined, videoRef.current ?? undefined, async (result) => {
          const value=result?.getText?.() || '';
          if(!value || !isTransferFrame(value)) return;
          const frame=parseTransferFrame(value); if(!frame) return;
          try {
            const added=await addTransferFrame(frame);
            setProgress(prev => ({
              session:added.session,
              received:added.received,
              total:added.total,
              name:added.name,
              missingCount:added.missingCount,
              missing:null,
              duplicates:(prev?.session===added.session ? prev.duplicates : 0) + (added.duplicate ? 1 : 0),
            }));
            if(added.complete){
              const rebuilt=await reconstructTransfer(added.session);
              if(rebuilt){
                setResult({url:rebuilt.url,name:rebuilt.name,size:rebuilt.size});
                setProgress(null);
                stopReceive();
              }
            }
          } catch(e) {
            setError(e instanceof Error?e.message:'Transfer verification failed.');
          }
        });
        if (receivingRef.current) {
          zxingControlsRef.current = controls;
        } else {
          controls.stop();
        }
      }
    } catch(e) { setError(e instanceof Error?e.message:'Camera permission was denied.'); setReceiving(false); receivingRef.current=false; }
  }
  function stopReceive() { receivingRef.current=false; detectorRef.current=null; zxingControlsRef.current?.stop(); zxingControlsRef.current=null; zxingRef.current=null; streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null; setReceiving(false); }
  function stopPlayback() { setPlaying(false); if(playTimerRef.current!==null){window.clearInterval(playTimerRef.current);playTimerRef.current=null;} }

  async function enterFullscreen() { try { await playerRef.current?.requestFullscreen?.(); setFullscreen(true); } catch { setError('Fullscreen is not available on this browser.'); } }
  async function exitFullscreen() { try { if(document.fullscreenElement) await document.exitFullscreen(); } catch {} setFullscreen(false); }
  async function choose(value?:File) { if(!value)return; setError(''); stopPlayback(); try {const t=await createTransfer(value);setFile(value);setPlan(t);setIndex(0);} catch(e){setPlan(null);setFile(null);setQr('');setError(e instanceof Error?e.message:'Unable to prepare this file.');} }

  return <section className="mx-auto max-w-6xl py-8 sm:py-12">
    <Link to="/" className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">Back home</Link>
    <div className="mt-5 overflow-hidden rounded-[32px] border border-cyan-300/15 bg-[var(--bg-elevated)] p-6 shadow-glass backdrop-blur-2xl sm:p-9">
      <div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-cyan-200"><Radio size={14}/> OR Transfer</span><span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"><WifiOff size={14}/> No internet</span></div>
      <h1 className="mt-5 text-4xl font-black tracking-[-.045em] sm:text-6xl">Move files with <span className="text-gradient">QR frames.</span></h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">An offline, byte-accurate transfer protocol. The sender displays QR frames and the receiver continuously collects them.</p>
    </div>
    <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-1"><button onClick={()=>{stopReceive();setTab('send')}} className={`rounded-xl px-4 py-3 text-sm font-bold ${tab==='send'?'bg-white text-slate-950':'text-[var(--text-muted)]'}`}><FileUp size={15} className="mr-2 inline"/>Send</button><button onClick={()=>setTab('receive')} className={`rounded-xl px-4 py-3 text-sm font-bold ${tab==='receive'?'bg-white text-slate-950':'text-[var(--text-muted)]'}`}><ScanLine size={15} className="mr-2 inline"/>Receive</button></div>
    {tab==='send'?<div className="mt-5 grid gap-5 lg:grid-cols-[.85fr_1fr]">
      <div className="glass-panel rounded-[28px] p-5"><input ref={inputRef} type="file" className="sr-only" onChange={e=>{void choose(e.target.files?.[0]);e.currentTarget.value='';}}/><button onClick={()=>inputRef.current?.click()} className="w-full rounded-[24px] border border-dashed border-cyan-300/30 bg-cyan-300/[.05] p-8 text-center"><FileUp className="mx-auto text-cyan-300" size={30}/><p className="mt-3 font-bold">Choose any file</p><p className="mt-1 text-xs text-[var(--text-muted)]">Up to 100 MB · processed locally</p></button>{file&&<div className="mt-4 rounded-2xl bg-white/5 p-4"><p className="truncate font-bold">{file.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{(file.size/1024/1024).toFixed(2)} MB · {plan?.total ?? 0} QR frames</p></div>}<div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white/5 p-4"><ShieldCheck size={18} className="text-emerald-300"/><p className="mt-2 text-sm font-bold">Byte-accurate</p><p className="mt-1 text-xs text-[var(--text-muted)]">SHA-256 verifies the reconstructed file.</p></div><div className="rounded-2xl bg-white/5 p-4"><LockKeyhole size={18} className="text-cyan-300"/><p className="mt-2 text-sm font-bold">Local only</p><p className="mt-1 text-xs text-[var(--text-muted)]">No upload or server is involved.</p></div></div></div>
      <div ref={playerRef} className="glass-panel rounded-[28px] p-5">{qr?<><div className="rounded-[28px] bg-white p-5"><img src={qr} alt="OR Transfer frame" className="mx-auto max-h-[78vh] w-full max-w-[900px] object-contain" style={{imageRendering:'pixelated'}}/></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">Frame {index+1} / {plan?.total ?? 0}</p><div className="flex flex-wrap gap-2"><button disabled={!plan} onClick={()=>setIndex(i=>Math.max(0,i-1))} className="rounded-full bg-white/10 px-4 py-2 text-sm">Prev</button><button disabled={!plan} onClick={()=>setIndex(i=>Math.min((plan?.total ?? 1)-1,i+1))} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950">Next</button><button disabled={!plan || plan.total<2} onClick={()=>playing?stopPlayback():setPlaying(true)} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950">{playing?'Pause':'Play stream'}</button><button disabled={!plan} onClick={()=>fullscreen?void exitFullscreen():void enterFullscreen()} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950">{fullscreen?'Exit full screen':'Full screen'}</button></div></div><div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-muted)]"><span>Frame interval</span><select value={intervalMs} onChange={e=>setIntervalMs(Number(e.target.value))} className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5"><option value="350">Fast · 350ms</option><option value="500">500ms</option><option value="700">700ms</option><option value="1000">Recommended · 1 sec</option><option value="1500">1.5 sec</option></select></div><p className="mt-3 text-center text-xs leading-5 text-[var(--text-muted)]">Keep this screen bright and steady. The stream loops automatically so missed frames can be captured on the next pass.</p></>:<div className="grid min-h-[520px] place-items-center text-center text-[var(--text-muted)]"><Radio size={36} className="mx-auto text-cyan-300"/><p className="mt-3 font-bold text-[var(--text)]">Transfer QR will appear here</p><p className="mt-1 text-sm">Choose a file to begin.</p></div>}</div>
    </div>:<div className="mt-5 glass-panel rounded-[28px] p-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <div className="overflow-hidden rounded-[24px] bg-black/20"><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline/></div>
        <div>
          <div className="flex flex-wrap gap-2">
            <button onClick={()=>receiving?stopReceive():void startReceive()} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950">{receiving?'Stop camera':'Start receiving'}</button>
            {progress&&<button onClick={()=>{void clearTransfer(progress.session);setProgress(null);setError('');}} className="rounded-full bg-white/10 px-4 py-3 text-sm font-bold text-[var(--text)]">Reset session</button>}
          </div>
          {progress&&<div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.05] p-4">
            <p className="truncate text-sm font-bold">{progress.name}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{progress.received} / {progress.total} unique frames · {progress.duplicates} duplicate reads</p>
            <div className="mt-3 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{width:`${Math.round(progress.received/progress.total*100)}%`}}/></div>
            {progress.missingCount>0&&<div className="mt-3 rounded-xl bg-white/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-cyan-300">Recovery status</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{progress.missingCount} frame{progress.missingCount===1?'':'s'} still missing. Keep the sender looping and keep scanning.</p>
              {progress.missing&&<p className="mt-1 break-words text-[11px] leading-5 text-[var(--text-muted)]">Missing: {progress.missing.slice(0,40).join(', ')}{progress.missing.length>40?` +${progress.missing.length-40} more`:''}</p>}
              <button onClick={()=>{void (async()=>{const missing=await getTransferMissingFrames(progress.session);setProgress(prev=>prev?{...prev,missing}:prev);})();}} className="mt-3 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-[var(--text)]">Show missing frames</button>
            </div>}
            {progress.missingCount===0&&<p className="mt-3 text-xs leading-5 text-emerald-300">All frames received. Verifying the original file…</p>}
          </div>}
          {result&&<div className="mt-5 rounded-2xl bg-emerald-400/10 p-4"><ShieldCheck className="text-emerald-300"/><p className="mt-2 font-bold">File reconstructed & verified</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{result.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{(result.size/1024/1024).toFixed(2)} MB · SHA-256 verified</p><a href={result.url} download={result.name} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950"><Download size={14}/> Save file</a></div>}
          {error&&<p className="mt-5 rounded-2xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
          {!progress&&!result&&!error&&<p className="mt-5 text-sm leading-6 text-[var(--text-muted)]">Start the receiver, then point this camera at the sender’s looping OR Transfer QR stream. Frames may arrive out of order and duplicates are ignored.</p>}
        </div>
      </div>
    </div>
    <div className="mt-5 grid gap-3 md:grid-cols-3">{[['01','Split','Original bytes are split into QR-safe frames.'],['02','Scan','The receiver collects frames automatically.'],['03','Verify','SHA-256 confirms the exact original file.']].map(([n,t,d])=><div key={n} className="glass-panel rounded-[24px] p-5"><span className="text-xs font-black text-cyan-300">{n}</span><h2 className="mt-2 font-bold">{t}</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{d}</p></div>)}</div>
  </section>;
}

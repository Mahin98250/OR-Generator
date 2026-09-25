import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, LockKeyhole, Radio, ScanLine, ShieldCheck, WifiOff } from 'lucide-react';
import QRCode from 'qrcode';
import { Link } from 'react-router-dom';
import { addTransferFrame, createTransfer, isTransferFrame, parseTransferFrame, reconstructTransfer } from '../../lib/orTransfer';

type Detector = { detect:(source:HTMLVideoElement)=>Promise<Array<{rawValue?:string}>> };
type DetectorCtor = new (options?:{formats?:string[]}) => Detector;

export function Transfer() {
  const [tab,setTab]=useState<'send'|'receive'>('send');
  const [file,setFile]=useState<File|null>(null);
  const [frames,setFrames]=useState<string[]>([]);
  const [index,setIndex]=useState(0);
  const [qr,setQr]=useState('');
  const [error,setError]=useState('');
  const [receiving,setReceiving]=useState(false);
  const [progress,setProgress]=useState<{session:string;received:number;total:number;name:string}|null>(null);
  const [result,setResult]=useState<{url:string;name:string;size:number}|null>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const receivingRef=useRef(false);
  const detectorRef=useRef<Detector|null>(null);

  useEffect(()=>{ if(!frames.length)return; let cancelled=false; QRCode.toDataURL(frames[index],{width:520,margin:2,errorCorrectionLevel:'L'}).then(v=>{if(!cancelled)setQr(v);}).catch(()=>setError('Unable to render transfer QR.')); return()=>{cancelled=true;}; },[frames,index]);
  useEffect(()=>()=>stopReceive(),[]);

  async function scanLoop() {
    if(!receivingRef.current||!videoRef.current||!detectorRef.current)return;
    try {
      const found=await detectorRef.current.detect(videoRef.current);
      for(const item of found) {
        const value=item.rawValue||''; if(!isTransferFrame(value))continue;
        const frame=parseTransferFrame(value); if(!frame)continue;
        const added=addTransferFrame(frame);
        setProgress({session:added.session,received:added.received,total:added.total,name:added.name});
        if(added.complete) {
          const rebuilt=await reconstructTransfer(added.session);
          if(rebuilt){setResult({url:rebuilt.url,name:rebuilt.name,size:rebuilt.size});stopReceive();return;}
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
      if(!('BarcodeDetector' in window)) { setError('Live OR Transfer needs a browser with BarcodeDetector. Use the main Scanner for camera compatibility.'); return; }
      const Ctor=(window as unknown as {BarcodeDetector:DetectorCtor}).BarcodeDetector;
      detectorRef.current=new Ctor({formats:['qr_code']});
      void scanLoop();
    } catch(e) { setError(e instanceof Error?e.message:'Camera permission was denied.'); setReceiving(false); receivingRef.current=false; }
  }
  function stopReceive() { receivingRef.current=false; detectorRef.current=null; streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null; setReceiving(false); }

  async function choose(value?:File) { if(!value)return; setError(''); try {const t=await createTransfer(value);setFile(value);setFrames(t.frames);setIndex(0);} catch(e){setError(e instanceof Error?e.message:'Unable to prepare this file.');} }

  return <section className="mx-auto max-w-6xl py-8 sm:py-12">
    <Link to="/" className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">Back home</Link>
    <div className="mt-5 overflow-hidden rounded-[32px] border border-cyan-300/15 bg-[var(--bg-elevated)] p-6 shadow-glass backdrop-blur-2xl sm:p-9">
      <div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-cyan-200"><Radio size={14}/> OR Transfer</span><span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"><WifiOff size={14}/> No internet</span></div>
      <h1 className="mt-5 text-4xl font-black tracking-[-.045em] sm:text-6xl">Move files with <span className="text-gradient">QR frames.</span></h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">An offline, byte-accurate transfer protocol. The sender displays QR frames and the receiver continuously collects them.</p>
    </div>
    <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-1"><button onClick={()=>{stopReceive();setTab('send')}} className={`rounded-xl px-4 py-3 text-sm font-bold ${tab==='send'?'bg-white text-slate-950':'text-[var(--text-muted)]'}`}><FileUp size={15} className="mr-2 inline"/>Send</button><button onClick={()=>setTab('receive')} className={`rounded-xl px-4 py-3 text-sm font-bold ${tab==='receive'?'bg-white text-slate-950':'text-[var(--text-muted)]'}`}><ScanLine size={15} className="mr-2 inline"/>Receive</button></div>
    {tab==='send'?<div className="mt-5 grid gap-5 lg:grid-cols-[.85fr_1fr]">
      <div className="glass-panel rounded-[28px] p-5"><input ref={inputRef} type="file" className="sr-only" onChange={e=>{void choose(e.target.files?.[0]);e.currentTarget.value='';}}/><button onClick={()=>inputRef.current?.click()} className="w-full rounded-[24px] border border-dashed border-cyan-300/30 bg-cyan-300/[.05] p-8 text-center"><FileUp className="mx-auto text-cyan-300" size={30}/><p className="mt-3 font-bold">Choose any file</p><p className="mt-1 text-xs text-[var(--text-muted)]">Up to 100 MB · processed locally</p></button>{file&&<div className="mt-4 rounded-2xl bg-white/5 p-4"><p className="truncate font-bold">{file.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{(file.size/1024/1024).toFixed(2)} MB · {frames.length} QR frames</p></div>}<div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white/5 p-4"><ShieldCheck size={18} className="text-emerald-300"/><p className="mt-2 text-sm font-bold">Byte-accurate</p><p className="mt-1 text-xs text-[var(--text-muted)]">SHA-256 verifies the reconstructed file.</p></div><div className="rounded-2xl bg-white/5 p-4"><LockKeyhole size={18} className="text-cyan-300"/><p className="mt-2 text-sm font-bold">Local only</p><p className="mt-1 text-xs text-[var(--text-muted)]">No upload or server is involved.</p></div></div></div>
      <div className="glass-panel rounded-[28px] p-5">{qr?<><div className="rounded-[28px] bg-white p-5"><img src={qr} alt="OR Transfer frame" className="mx-auto w-full max-w-[520px]"/></div><div className="mt-4 flex items-center justify-between"><p className="text-sm font-bold">Frame {index+1} / {frames.length}</p><div className="flex gap-2"><button disabled={!frames.length} onClick={()=>setIndex(i=>Math.max(0,i-1))} className="rounded-full bg-white/10 px-4 py-2 text-sm">Prev</button><button disabled={!frames.length} onClick={()=>setIndex(i=>Math.min(frames.length-1,i+1))} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950">Next</button></div></div><p className="mt-3 text-center text-xs leading-5 text-[var(--text-muted)]">Display this QR on the sender and scan it with the receiving phone.</p></>:<div className="grid min-h-[520px] place-items-center text-center text-[var(--text-muted)]"><Radio size={36} className="mx-auto text-cyan-300"/><p className="mt-3 font-bold text-[var(--text)]">Transfer QR will appear here</p><p className="mt-1 text-sm">Choose a file to begin.</p></div>}</div>
    </div>:<div className="mt-5 glass-panel rounded-[28px] p-5"><div className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><div className="overflow-hidden rounded-[24px] bg-black/20"><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline/></div><div><button onClick={()=>receiving?stopReceive():void startReceive()} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950">{receiving?'Stop camera':'Start receiving'}</button>{progress&&<div className="mt-5"><p className="truncate text-sm font-bold">{progress.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{progress.received} / {progress.total} frames</p><div className="mt-3 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300" style={{width:`${Math.round(progress.received/progress.total*100)}%`}}/></div></div>}{result&&<div className="mt-5 rounded-2xl bg-emerald-400/10 p-4"><ShieldCheck className="text-emerald-300"/><p className="mt-2 font-bold">File reconstructed</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{result.name}</p><a href={result.url} download={result.name} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950"><Download size={14}/> Save file</a></div>}{error&&<p className="mt-5 rounded-2xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}</div></div></div>}
    <div className="mt-5 grid gap-3 md:grid-cols-3">{[['01','Split','Original bytes are split into QR-safe frames.'],['02','Scan','The receiver collects frames automatically.'],['03','Verify','SHA-256 confirms the exact original file.']].map(([n,t,d])=><div key={n} className="glass-panel rounded-[24px] p-5"><span className="text-xs font-black text-cyan-300">{n}</span><h2 className="mt-2 font-bold">{t}</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{d}</p></div>)}</div>
  </section>;
}

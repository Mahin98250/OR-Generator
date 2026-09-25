import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, Copy, Download, FlaskConical, Pause, Play, RotateCcw, ScanLine, Upload, Zap } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassButton } from '../../components/ui/GlassButton';
import { decodeOptiFrame, decodeOptiFramePerspective, encodeOptiFrame, getOptiFrameCapacity, OPTIFRAME_SIZE } from '../../lib/optiframe';
import { OptiFrameAssembler, splitOptiFramePayload, utf8ToText } from '../../lib/optiframeStream';

type CameraStats = {
  attempts: number;
  hits: number;
  duplicates: number;
  lastMs: number;
  bytes: number;
  fps: number;
  startedAt: number | null;
};

export function OptiFrameLab() {
  const [text, setText] = useState('OptiCode experimental optical stream');
  const [seq, setSeq] = useState(0);
  const [total, setTotal] = useState(1);
  const [image, setImage] = useState('');
  const [decoded, setDecoded] = useState('');
  const [status, setStatus] = useState('Generate a frame to begin.');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraDecoded, setCameraDecoded] = useState('');
  const [receiver, setReceiver] = useState({ total: 0, received: 0, bytes: 0, missing: [] as number[], complete: false });
  const [cameraStats, setCameraStats] = useState<CameraStats>({ attempts: 0, hits: 0, duplicates: 0, lastMs: 0, bytes: 0, fps: 0, startedAt: null });
  const [streamPlaying, setStreamPlaying] = useState(false);
  const [streamIndex, setStreamIndex] = useState(0);

  const capacity = useMemo(() => getOptiFrameCapacity(), []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const senderTimerRef = useRef<number | null>(null);
  const assemblerRef = useRef(new OptiFrameAssembler());
  const seenSequenceRef = useRef(new Set<number>());

  const streamPayload = useMemo(() => {
    const payload = new TextEncoder().encode(text);
    return splitOptiFramePayload(payload, capacity);
  }, [text, capacity]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    setStreamIndex(index => index % Math.max(1, streamPayload.length));
  }, [streamPayload.length]);

  useEffect(() => {
    if (!streamPlaying) return;
    senderTimerRef.current = window.setInterval(() => {
      setStreamIndex(index => (index + 1) % Math.max(1, streamPayload.length));
    }, 300);
    return () => {
      if (senderTimerRef.current !== null) window.clearInterval(senderTimerRef.current);
      senderTimerRef.current = null;
    };
  }, [streamPlaying, streamPayload.length]);

  const streamFrame = useMemo(() => {
    try {
      const payload = streamPayload[streamIndex] ?? new Uint8Array();
      return encodeOptiFrame(payload, streamIndex, Math.max(1, streamPayload.length)).canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }, [streamPayload, streamIndex]);

  function generate() {
    try {
      const payload = new TextEncoder().encode(text);
      const out = encodeOptiFrame(payload, seq, total);
      setImage(out.canvas.toDataURL('image/png'));
      setDecoded('');
      setStatus(`Encoded frame ${seq + 1}/${total}; 4 luminance levels, 2-bit symbols and CRC-32.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to encode frame.');
    }
  }

  function load(file?: File) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const out = decodeOptiFrame(img) ?? decodeOptiFramePerspective(img)?.frame;
        if (!out) throw new Error('Rejected: invalid frame, perspective correction failed, or CRC mismatch.');
        setDecoded(utf8ToText(out.payload));
        setStatus(`Decoded frame ${out.sequence + 1}/${out.total}; CRC-32 verified.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Unable to decode frame.');
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setStatus('Unable to read that image.');
    };
    img.src = url;
  }

  function save() {
    if (!image) return;
    const link = document.createElement('a');
    link.href = image;
    link.download = 'optiframe.png';
    link.click();
  }

  async function copy() {
    if (decoded && navigator.clipboard) await navigator.clipboard.writeText(decoded);
  }

  function stopCamera() {
    if (loopRef.current !== null) {
      window.clearTimeout(loopRef.current);
      loopRef.current = null;
    }
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function decodeCameraFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !streamRef.current) return;

    const started = performance.now();
    const result = decodeOptiFramePerspective(video);
    const elapsed = performance.now() - started;

    setCameraStats(prev => {
      const attempts = prev.attempts + 1;
      const elapsedSinceStart = prev.startedAt ? Math.max(0.001, (performance.now() - prev.startedAt) / 1000) : 0;
      return {
        ...prev,
        attempts,
        lastMs: elapsed,
        fps: elapsedSinceStart ? attempts / elapsedSinceStart : 0,
      };
    });

    if (!result) return;

    const frame = result.frame;
    if (frame.sequence === 0 && receiver.complete) {
      seenSequenceRef.current.clear();
      assemblerRef.current.reset();
    }

    const duplicate = seenSequenceRef.current.has(frame.sequence);
    const assembly = assemblerRef.current.add(frame);
    seenSequenceRef.current.add(frame.sequence);

    setCameraStats(prev => ({
      ...prev,
      hits: prev.hits + 1,
      duplicates: prev.duplicates + (duplicate ? 1 : 0),
      bytes: assembly.bytes,
    }));

    setReceiver({
      total: assembly.total,
      received: assembly.received,
      bytes: assembly.bytes,
      missing: assembly.missing.slice(0, 40),
      complete: assembly.complete,
    });

    setStatus(`Live frame ${frame.sequence + 1}/${frame.total} · ${Math.round(result.diagnostics.confidence * 100)}% anchor confidence · ${result.diagnostics.decodeMs.toFixed(0)} ms decode`);

    if (assembly.complete && assembly.payload) {
      setCameraDecoded(utf8ToText(assembly.payload));
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser does not expose camera access.');
      return;
    }

    stopCamera();
    setCameraError('');
    assemblerRef.current.reset();
    seenSequenceRef.current.clear();
    setReceiver({ total: 0, received: 0, bytes: 0, missing: [], complete: false });
    setCameraDecoded('');
    setCameraStats({ attempts: 0, hits: 0, duplicates: 0, lastMs: 0, bytes: 0, fps: 0, startedAt: performance.now() });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);

      const tick = async () => {
        if (!streamRef.current) return;
        await decodeCameraFrame();
        loopRef.current = window.setTimeout(() => void tick(), 280);
      };
      loopRef.current = window.setTimeout(() => void tick(), 280);
    } catch (error) {
      setCameraError(error instanceof DOMException ? error.message : 'Camera permission was denied or unavailable.');
      stopCamera();
    }
  }

  function resetReceiver() {
    assemblerRef.current.reset();
    seenSequenceRef.current.clear();
    setReceiver({ total: 0, received: 0, bytes: 0, missing: [], complete: false });
    setCameraDecoded('');
    setCameraStats(prev => ({ ...prev, hits: 0, duplicates: 0, bytes: 0 }));
  }

  return (
    <section className="mx-auto max-w-7xl py-8 sm:py-12">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">Phase 2 · Experimental optical layer</p>
          <h1 className="mt-2 text-4xl font-black text-[var(--text)] sm:text-6xl">OptiFrame Lab</h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--text-muted)]">Custom 128×128 optical frames with four luminance levels, 2-bit symbols, four finder anchors, CRC-32, perspective correction and multi-frame reassembly. This is a research layer, not a claim of benchmarked superiority over QR.</p>
        </div>
        <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-300">{capacity} payload bytes / frame</div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-400/10 text-violet-300"><FlaskConical size={18}/></span>
            <div><p className="text-sm font-bold text-[var(--text)]">Frame builder</p><p className="mt-1 text-[10px] uppercase tracking-[.14em] text-[var(--text-muted)]">Axis-aligned + perspective-corrected image decode</p></div>
          </div>
          <textarea value={text} onChange={event => setText(event.target.value)} className="mt-5 min-h-32 w-full rounded-[22px] border border-[var(--border)] bg-[var(--bg-soft)] p-4 text-sm text-[var(--text)] outline-none" />
          <div className="mt-2 text-[10px] text-[var(--text-muted)]">{new TextEncoder().encode(text).length.toLocaleString()} bytes · stream automatically fragments above {capacity.toLocaleString()} bytes.</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-3"><span className="text-[10px] text-[var(--text-muted)]">Sequence</span><input type="number" min="0" max="65535" value={seq} onChange={event => setSeq(Math.max(0, Math.min(65535, Number(event.target.value) || 0)))} className="mt-1 w-full bg-transparent text-[var(--text)] outline-none" /></label>
            <label className="rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-3"><span className="text-[10px] text-[var(--text-muted)]">Total</span><input type="number" min="1" max="65535" value={total} onChange={event => setTotal(Math.max(1, Math.min(65535, Number(event.target.value) || 1)))} className="mt-1 w-full bg-transparent text-[var(--text)] outline-none" /></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <GlassButton onClick={generate}><Zap size={14}/> Generate OptiFrame</GlassButton>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-bold text-[var(--text)]"><Upload size={14}/> Decode image<input type="file" accept="image/*" className="hidden" onChange={event => load(event.target.files?.[0])}/></label>
            <button onClick={save} disabled={!image} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-xs font-bold text-[var(--text)] disabled:opacity-40"><Download size={14}/> Save</button>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-4"><p className="text-xs font-bold text-[var(--text)]">Status</p><p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{status}</p></div>
          {decoded && <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-300">Verified payload</p><p className="mt-2 break-words text-sm text-[var(--text)]">{decoded}</p><button onClick={() => void copy()} className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--text)]"><Copy size={13}/> Copy</button></div>}
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-bold text-[var(--text)]">Optical surface</p><p className="mt-1 text-[10px] uppercase tracking-[.14em] text-[var(--text-muted)]">{OPTIFRAME_SIZE}×{OPTIFRAME_SIZE} · 4 luminance levels</p></div>
            <span className="rounded-full border border-[var(--border)] px-3 py-2 text-[10px] font-bold text-[var(--text-muted)]">{streamPayload.length} stream frame{streamPayload.length === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-5 grid place-items-center rounded-[26px] bg-white p-4">
            {streamFrame ? <img src={streamFrame} alt="OptiFrame stream frame" className="block aspect-square w-full max-w-[560px] [image-rendering:pixelated]" /> : <div className="aspect-square w-full max-w-[560px]" />}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <GlassButton onClick={() => setStreamPlaying(value => !value)}>{streamPlaying ? <Pause size={14}/> : <Play size={14}/>} {streamPlaying ? 'Pause stream' : 'Play stream'}</GlassButton>
            <button onClick={() => setStreamIndex(index => (index + streamPayload.length - 1) % Math.max(1, streamPayload.length))} className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-bold text-[var(--text)]">Previous</button>
            <button onClick={() => setStreamIndex(index => (index + 1) % Math.max(1, streamPayload.length))} className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-bold text-[var(--text)]">Next</button>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">Open this page on a second device and start Live camera receiver there. Put the sender surface in front of that camera to test real optical capture and reassembly.</p>
        </GlassCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <GlassCard>
          <div className="flex items-center justify-between gap-3">
            <div><div className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">{cameraOn ? <CheckCircle2 size={16} className="text-emerald-300"/> : <ScanLine size={16} className="text-cyan-300"/>} Live camera receiver</div><p className="mt-1 text-xs text-[var(--text-muted)]">Perspective correction runs locally on the browser using the four finder anchors. Camera frames never leave the device.</p></div>
            <button onClick={() => void (cameraOn ? stopCamera() : startCamera())} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-950">{cameraOn ? <CameraOff size={14}/> : <Camera size={14}/>} {cameraOn ? 'Stop camera' : 'Start camera'}</button>
          </div>
          <div className="mt-4 overflow-hidden rounded-[26px] bg-black">
            <div className="relative aspect-[4/3]">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              {!cameraOn && <div className="absolute inset-0 grid place-items-center bg-black/55"><div className="text-center"><ScanLine size={28} className="mx-auto text-white/70"/><p className="mt-3 text-sm font-bold text-white">Point the camera at an OptiFrame</p><p className="mt-1 text-xs text-white/50">Keep all four finder anchors visible.</p></div></div>}
              {cameraOn && <div className="pointer-events-none absolute inset-[7%] rounded-[24px] border border-cyan-300/60 shadow-[0_0_0_999px_rgba(0,0,0,.18)]"><div className="absolute inset-4 border border-white/15"/></div>}
            </div>
          </div>
          {cameraError && <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-xs leading-6 text-rose-100">{cameraError}</div>}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-3"><p className="text-[10px] text-[var(--text-muted)]">Attempts</p><p className="mt-1 text-lg font-black text-[var(--text)]">{cameraStats.attempts}</p></div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-3"><p className="text-[10px] text-[var(--text-muted)]">Decoded</p><p className="mt-1 text-lg font-black text-[var(--text)]">{cameraStats.hits}</p></div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-3"><p className="text-[10px] text-[var(--text-muted)]">Duplicates</p><p className="mt-1 text-lg font-black text-[var(--text)]">{cameraStats.duplicates}</p></div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-3"><p className="text-[10px] text-[var(--text-muted)]">Decode ms</p><p className="mt-1 text-lg font-black text-[var(--text)]">{cameraStats.lastMs.toFixed(0)}</p></div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-3"><p className="text-[10px] text-[var(--text-muted)]">Payload</p><p className="mt-1 text-lg font-black text-[var(--text)]">{cameraStats.bytes.toLocaleString()} B</p></div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-3"><p className="text-[10px] text-[var(--text-muted)]">Decode FPS</p><p className="mt-1 text-lg font-black text-[var(--text)]">{cameraStats.fps.toFixed(1)}</p></div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-[var(--text)]">Receiver state</p><p className="mt-1 text-xs text-[var(--text-muted)]">{receiver.total ? `${receiver.received}/${receiver.total} frames received` : 'Waiting for a frame.'}</p></div><button onClick={resetReceiver} className="rounded-full p-2 text-[var(--text-muted)] hover:bg-white/10" aria-label="Reset receiver"><RotateCcw size={16}/></button></div>
          {receiver.total > 0 && <><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{width:`${Math.min(100, receiver.received / receiver.total * 100)}%`}}/></div><p className="mt-3 text-xs text-[var(--text-muted)]">{receiver.complete ? 'Complete payload reassembled in sequence order.' : `Missing: ${receiver.missing.slice(0, 18).join(', ')}${receiver.missing.length > 18 ? '…' : ''}`}</p></>}
          {cameraDecoded && <div className="mt-5 rounded-[22px] border border-emerald-300/20 bg-emerald-300/10 p-4"><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-emerald-300"><CheckCircle2 size={14}/> Reassembled payload</p><p className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">{cameraDecoded}</p><button onClick={() => void navigator.clipboard?.writeText(cameraDecoded)} className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--text)]"><Copy size={13}/> Copy payload</button></div>}
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4"><p className="text-xs font-bold text-[var(--text)]">Lab status</p><p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">This milestone adds a pure browser homography solver, adaptive luminance calibration, four-anchor finder detection, and sequence-aware reassembly. The production file-transfer path remains OptiTransfer 2.0 until this custom layer earns a physical benchmark.</p></div>
        </GlassCard>
      </div>
    </section>
  );
}

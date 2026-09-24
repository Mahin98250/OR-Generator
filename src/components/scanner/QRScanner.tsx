import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { BrowserMultiFormatReader } from '@zxing/browser';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Flashlight,
  ImageUp,
  RefreshCw,
  RotateCcw,
  Save,
  ScanLine,
  Sparkles,
  Square,
  Upload,
  ZoomIn,
  ScanBarcode,
} from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { saveHistoryItem } from '../../lib/storage';

type ScanMode = 'auto' | 'qr' | 'barcode';

type BarcodeResult = { rawValue?: string; format?: string };

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<BarcodeResult[]>;
};

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

const COMMON_BARCODE_FORMATS = [
  'aztec',
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'data_matrix',
  'ean_13',
  'ean_8',
  'itf',
  'pdf417',
  'qr_code',
  'upc_a',
  'upc_e',
];

function normalizeFormat(value?: string) {
  if (!value) return 'CODE';
  return value
    .replace(/^BarcodeFormat\./, '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function QRScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const zxingRef = useRef<BrowserMultiFormatReader | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const lastScanRef = useRef(0);

  const [result, setResult] = useState('');
  const [format, setFormat] = useState('QR CODE');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: .1 });
  const [dragActive, setDragActive] = useState(false);
  const [mode, setMode] = useState<ScanMode>('auto');
  const [engine, setEngine] = useState('Preparing scanner');
  const [supportedFormats, setSupportedFormats] = useState<string[]>([]);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;

    zxingControlsRef.current?.stop();
    zxingControlsRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;

    setScanning(false);
    setTorch(false);
  }

  async function createNativeDetector(nextMode: ScanMode) {
    const Constructor = window.BarcodeDetector;
    if (!Constructor) return false;

    try {
      const available = (await Constructor.getSupportedFormats?.()) ?? COMMON_BARCODE_FORMATS;
      const requested = nextMode === 'qr'
        ? ['qr_code']
        : nextMode === 'barcode'
          ? available.filter((item) => item !== 'qr_code')
          : available;

      if (!requested.length) return false;

      detectorRef.current = new Constructor({ formats: requested });
      setSupportedFormats(available);
      setEngine(`Native scanner · ${requested.length} formats`);
      return true;
    } catch {
      detectorRef.current = null;
      return false;
    }
  }

  async function startZXing(video: HTMLVideoElement) {
    try {
      const reader = new BrowserMultiFormatReader();
      zxingRef.current = reader;

      const controls = await reader.decodeFromVideoElement(video, (decoded, decodeError) => {
        if (decoded?.getText()) {
          handleDecoded(decoded.getText(), normalizeFormat(decoded.getBarcodeFormat()?.toString()));
          controls?.stop();
          return;
        }
        void decodeError;
      });

      zxingControlsRef.current = controls;
      setEngine('ZXing fallback · multi-format');
    } catch {
      setEngine('QR fallback');
      scanFrame();
    }
  }

  async function startCamera(nextFacing = facingMode) {
    setError('');
    setResult('');
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is unavailable here. Open the installed app or an HTTPS page.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const capabilities = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        torch?: boolean;
        zoom?: { min: number; max: number; step?: number };
      };

      if (capabilities.zoom) {
        setZoomRange({
          min: capabilities.zoom.min,
          max: capabilities.zoom.max,
          step: capabilities.zoom.step || .1,
        });
        setZoom(capabilities.zoom.min);
      } else {
        setZoomRange({ min: 1, max: 1, step: .1 });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setFacingMode(nextFacing);
      setScanning(true);

      const nativeReady = await createNativeDetector(mode);

      if (nativeReady) {
        scanFrame();
      } else if (videoRef.current) {
        await startZXing(videoRef.current);
      }
    } catch (cameraError) {
      const name = cameraError instanceof DOMException ? cameraError.name : '';
      if (name === 'NotAllowedError') setError('Camera permission was denied. Allow camera access in your browser settings and try again.');
      else if (name === 'NotFoundError') setError('No camera was found on this device.');
      else setError('The camera could not be started. Try another camera or upload an image instead.');
    }
  }

  async function scanFrame() {
    const video = videoRef.current;
    if (!video || !streamRef.current || !detectorRef.current) return;

    const now = performance.now();
    if (now - lastScanRef.current < 90) {
      frameRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    lastScanRef.current = now;

    try {
      if (video.readyState >= 2) {
        const detected = await detectorRef.current.detect(video);
        const hit = detected[0];
        if (hit?.rawValue) {
          handleDecoded(hit.rawValue, hit.format);
          return;
        }
      }
    } catch {
      // Keep scanning through transient camera/detector errors.
    }

    frameRef.current = requestAnimationFrame(scanFrame);
  }

  function handleDecoded(value: string, detectedFormat = 'qr_code') {
    if (!value) return;
    setResult(value);
    setFormat(normalizeFormat(detectedFormat));
    saveHistoryItem(value);
    stopCamera();
  }

  async function handleFile(file: File) {
    setError('');
    setResult('');

    if (!file.type.startsWith('image/')) {
      setError('Please choose a PNG, JPEG, WebP or another image file.');
      return;
    }

    try {
      const source = URL.createObjectURL(file);
      const image = new Image();

      image.onload = async () => {
        try {
          if (window.BarcodeDetector) {
            try {
              const Constructor = window.BarcodeDetector;
              const available = (await Constructor.getSupportedFormats?.()) ?? COMMON_BARCODE_FORMATS;
              const requested = mode === 'qr'
                ? ['qr_code']
                : mode === 'barcode'
                  ? available.filter((item) => item !== 'qr_code')
                  : available;

              if (requested.length) {
                const detector = new Constructor({ formats: requested });
                const detected = await detector.detect(image);
                if (detected[0]?.rawValue) {
                  URL.revokeObjectURL(source);
                  handleDecoded(detected[0].rawValue, detected[0].format);
                  return;
                }
              }
            } catch {
              // Fall through to ZXing.
            }
          }

          try {
            const reader = new BrowserMultiFormatReader();
            const decoded = await reader.decodeFromImageElement(image);
            if (decoded?.getText()) {
              URL.revokeObjectURL(source);
              handleDecoded(decoded.getText(), normalizeFormat(decoded.getBarcodeFormat()?.toString()));
              return;
            }
          } catch {
            // Fall through to the lightweight QR decoder.
          }

          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d', { willReadFrequently: true });

          if (!context) throw new Error('canvas');
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
          URL.revokeObjectURL(source);

          if (code?.data) handleDecoded(code.data, 'qr_code');
          else setError('No readable QR code or barcode was found. Try a sharper, better-lit image.');
        } catch {
          URL.revokeObjectURL(source);
          setError('Unable to read this image.');
        }
      };

      image.onerror = () => {
        URL.revokeObjectURL(source);
        setError('Unable to load the selected image.');
      };
      image.src = source;
    } catch {
      setError('Unable to scan the selected image.');
    }
  }

  async function copyResult() {
    if (!result || !navigator.clipboard) return;
    await navigator.clipboard.writeText(result);
  }

  async function applyCameraControl(name: 'torch' | 'zoom', value: boolean | number) {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;

    try {
      if (name === 'torch') {
        await track.applyConstraints({ advanced: [{ torch: Boolean(value) } as MediaTrackConstraintSet] });
        setTorch(Boolean(value));
      } else {
        await track.applyConstraints({ advanced: [{ zoom: Number(value) } as MediaTrackConstraintSet] });
        setZoom(Number(value));
      }
    } catch {
      setError('This camera does not support that control.');
    }
  }

  function toggleCamera() {
    void startCamera(facingMode === 'environment' ? 'user' : 'environment');
  }

  function changeMode(nextMode: ScanMode) {
    setMode(nextMode);
    if (scanning) void startCamera(facingMode);
  }

  return (
    <div className="space-y-5">
      <div className="glass-soft flex flex-col gap-3 rounded-[24px] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--text-muted)]">Scan mode</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">QR, product and industrial barcodes in one scanner.</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
          {([
            ['auto', 'Auto'],
            ['qr', 'QR only'],
            ['barcode', 'Barcode'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => changeMode(value)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${mode === value ? 'bg-[var(--text)] text-[var(--bg)] shadow-lg' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
        <div className="relative overflow-hidden rounded-[30px] border border-[var(--border)] bg-black shadow-2xl shadow-black/20">
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <span className={`h-2 w-2 rounded-full ${scanning ? 'animate-pulse bg-emerald-400' : 'bg-white/30'}`} />
              {scanning ? 'Scanning live' : 'Camera ready'}
            </div>
            <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-white/75">
              {format}
            </span>
          </div>

          <div className="relative aspect-[4/3] min-h-[300px] sm:min-h-[420px]">
            <video ref={videoRef} className="h-full w-full bg-black object-cover" muted playsInline />
            {!scanning && (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,rgba(99,229,255,.12),transparent_42%)]">
                <div className="text-center">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/10 text-white backdrop-blur-xl">
                    <ScanLine size={30} />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-white">Scan a QR code or barcode</p>
                  <p className="mt-1 text-xs text-white/50">Detection happens locally on your device.</p>
                </div>
              </div>
            )}
            {scanning && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className={`relative ${mode === 'barcode' ? 'h-[34%] w-[78%]' : 'h-[62%] w-[62%] max-w-[320px]'} rounded-[28px] border-2 border-white/70 shadow-[0_0_0_999px_rgba(0,0,0,.25)]`}>
                  <span className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-cyan-300" />
                  <span className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-cyan-300" />
                  <span className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-cyan-300" />
                  <span className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-cyan-300" />
                  <span className="absolute left-5 right-5 top-1/2 h-px animate-pulse bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,.9)]" />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/50 p-3 backdrop-blur-xl">
            <GlassButton onClick={() => void startCamera()} className="bg-white text-slate-950">
              <Camera size={15} /> {scanning ? 'Restart' : 'Start camera'}
            </GlassButton>
            <GlassButton onClick={stopCamera}><CameraOff size={15} /> Stop</GlassButton>
            <GlassButton onClick={toggleCamera} disabled={!streamRef.current} aria-label="Switch camera"><RotateCcw size={15} /></GlassButton>
            <GlassButton onClick={() => void applyCameraControl('torch', !torch)} disabled={!streamRef.current} aria-label="Toggle flashlight"><Flashlight size={15} /></GlassButton>
          </div>
        </div>

        <div className="space-y-3">
          <label
            className={`group flex min-h-[250px] cursor-pointer flex-col items-center justify-center rounded-[30px] border border-dashed p-7 text-center transition ${dragActive ? 'border-cyan-300 bg-cyan-300/10' : 'border-[var(--border)] bg-[var(--bg-soft)] hover:bg-white/5'}`}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              const file = event.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300/20 to-indigo-500/20 text-cyan-300">
              {dragActive ? <Upload size={24} /> : <ImageUp size={24} />}
            </span>
            <span className="mt-4 text-sm font-bold text-[var(--text)]">Scan from an image</span>
            <span className="mt-2 max-w-[240px] text-xs leading-5 text-[var(--text-muted)]">Photos, screenshots, product labels, tickets and documents.</span>
            <span className="mt-5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-semibold text-[var(--text)]">Choose image</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.currentTarget.value = '';
            }} />
          </label>

          <div className="glass-soft rounded-[24px] p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--text-muted)]">
              <Sparkles size={14} className="text-cyan-300" /> {engine}
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Multi-format decoding supports QR plus common 1D/2D formats such as EAN, UPC, Code 128, Code 39, Data Matrix and PDF417 when the browser engine or fallback decoder supports them.
            </p>
            {supportedFormats.length > 0 && (
              <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
                Native formats detected on this browser: {supportedFormats.map(normalizeFormat).join(' · ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {scanning && zoomRange.max > zoomRange.min && (
        <div className="glass-soft flex items-center gap-4 rounded-[22px] p-4">
          <ZoomIn size={17} className="shrink-0 text-[var(--text-muted)]" />
          <input aria-label="Camera zoom" type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step} value={zoom}
            onChange={(event) => void applyCameraControl('zoom', Number(event.target.value))} className="w-full accent-[var(--primary)]" />
          <span className="w-12 text-right text-xs font-semibold text-[var(--text-muted)]">{zoom.toFixed(1)}×</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-[22px] border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
          <span className="mt-0.5"><Square size={15} /></span>
          <p className="leading-6">{error}</p>
        </div>
      )}

      {result && (
        <div className="overflow-hidden rounded-[28px] border border-emerald-300/20 bg-emerald-400/[.06] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-300">
              {format.includes('QR') ? <CheckCircle2 size={16} /> : <ScanBarcode size={16} />}
              {format} detected
            </div>
            <button onClick={() => { setResult(''); setError(''); }} className="rounded-full p-2 text-[var(--text-muted)] hover:bg-white/10" aria-label="Clear result">
              <RefreshCw size={16} />
            </button>
          </div>
          <p className="mt-3 break-words rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-sm leading-6 text-[var(--text)]">{result}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <GlassButton onClick={() => void copyResult()}><Clipboard size={15} /> Copy</GlassButton>
            <GlassButton onClick={() => saveHistoryItem(result)}><Save size={15} /> Save</GlassButton>
            {isWebUrl(result) && (
              <a href={result} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg">
                <ExternalLink size={15} /> Open link
              </a>
            )}
            <GlassButton onClick={() => void startCamera()}><ScanLine size={15} /> Scan another</GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}

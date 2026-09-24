import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, ImageUp, Save, Square } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { saveHistoryItem } from '../../lib/storage';

export function QRScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function startCamera() {
    setError('');
    setResult('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported in this browser.');
      return;
    }

    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanFrame();
      }
    } catch {
      setError('Camera permission was denied or the camera is unavailable.');
    }
  }

  function stopCamera() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function scanFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      frameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (canvas.width > 0 && canvas.height > 0) {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height);

        if (code?.data) {
          setResult(code.data);
          saveHistoryItem(code.data);
          stopCamera();
          return;
        }
      }
    }

    frameRef.current = requestAnimationFrame(scanFrame);
  }

  async function handleFile(file: File) {
    setError('');
    setResult('');

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }

    try {
      const source = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });

        if (!context) {
          URL.revokeObjectURL(source);
          setError('Unable to read this image.');
          return;
        }

        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(pixels.data, pixels.width, pixels.height);
        URL.revokeObjectURL(source);

        if (code?.data) {
          setResult(code.data);
          saveHistoryItem(code.data);
        } else {
          setError('No QR code was found in that image.');
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
          <video
            ref={videoRef}
            className="aspect-video w-full bg-black object-cover"
            muted
            playsInline
          />
        </div>

        <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-white/12 bg-white/5 p-6 text-center">
          <ImageUp className="mb-3 text-white/65" size={28} />
          <span className="text-sm font-medium text-white">Scan an image</span>
          <span className="mt-2 text-xs text-white/45">PNG, JPEG, WebP</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <GlassButton type="button" onClick={() => void startCamera()} className="gap-2 bg-white text-slate-950">
          <Camera size={15} /> Start camera
        </GlassButton>
        <GlassButton type="button" onClick={stopCamera} className="gap-2">
          <Square size={14} /> Stop
        </GlassButton>
      </div>

      {error ? <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      {result ? (
        <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Decoded result</p>
          <p className="break-words text-sm leading-7 text-white/85">{result}</p>
          <div className="flex flex-wrap gap-2">
            <GlassButton type="button" onClick={() => void copyResult()}>
              Copy result
            </GlassButton>
            <GlassButton type="button" onClick={() => saveHistoryItem(result)} className="gap-2">
              <Save size={14} /> Save
            </GlassButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

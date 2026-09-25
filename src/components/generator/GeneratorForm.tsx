import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, RotateCcw } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { useGenerator } from './GeneratorContext';
import { encodeImageForQr } from '../../lib/imageQr';

export function GeneratorForm() {
  const { settings, setSettings } = useGenerator();
  const [imageMode, setImageMode] = useState(false);
  const [imageName, setImageName] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageInfo, setImageInfo] = useState('');
  const [error, setError] = useState('');
  const [encoding, setEncoding] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isValid = useMemo(() => settings.value.trim().length > 0, [settings.value]);

  async function chooseImage(file?: File) {
    if (!file) return;
    setError(''); setEncoding(true);
    try {
      const encoded = await encodeImageForQr(file);
      setImageMode(true); setImageName(file.name); setImagePreview(encoded.previewUrl);
      setImageInfo(`${encoded.width}×${encoded.height} · compact image payload`);
      setSettings(prev => ({ ...prev, value: encoded.payload, errorCorrectionLevel: 'L' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to prepare this image.');
    } finally { setEncoding(false); }
  }
  function reset() {
    setImageMode(false); setImageName(''); setImagePreview(''); setImageInfo(''); setError('');
    setSettings(prev => ({ ...prev, value: '' }));
  }

  return <div className="space-y-6">
    <div className="flex items-start gap-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300/20 to-indigo-500/25 text-cyan-200">{imageMode ? <ImagePlus size={19}/> : <Link2 size={19}/>}</div>
      <div><h2 className="text-xl font-bold text-[var(--text)]">What should this QR contain?</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Create a QR from text, links, or a compact photo that another OR-Generator scan can reconstruct.</p></div>
    </div>

    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-1">
      <button type="button" onClick={() => setImageMode(false)} className={`rounded-xl px-4 py-3 text-sm font-bold ${!imageMode ? 'bg-[var(--text)] text-[var(--bg)] shadow-lg' : 'text-[var(--text-muted)]'}`}><Link2 size={15} className="mr-2 inline" />Text / Link</button>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={encoding} className={`rounded-xl px-4 py-3 text-sm font-bold ${imageMode ? 'bg-[var(--text)] text-[var(--bg)] shadow-lg' : 'text-[var(--text-muted)]'}`}>{encoding ? <Loader2 size={15} className="mr-2 inline animate-spin" /> : <ImagePlus size={15} className="mr-2 inline" />}Photo → QR</button>
    </div>
    <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={e => { void chooseImage(e.target.files?.[0]); e.currentTarget.value=''; }} />

    {imageMode ? <div className="rounded-[24px] border border-cyan-300/20 bg-cyan-300/[.06] p-4">
      <div className="flex gap-4">{imagePreview && <img src={imagePreview} alt="Selected photo" className="h-24 w-24 shrink-0 rounded-2xl object-cover" />}<div className="min-w-0"><p className="text-sm font-bold text-[var(--text)]">Photo ready</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{imageName}</p><p className="mt-1 text-xs text-cyan-200">{imageInfo}</p><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">The compressed photo is stored directly inside the QR. No server or upload is required.</p></div></div>
      <div className="mt-4 flex gap-2"><GlassButton type="button" onClick={() => inputRef.current?.click()} disabled={encoding}><ImagePlus size={14}/> Replace photo</GlassButton><GlassButton type="button" onClick={reset}><RotateCcw size={14}/> Reset</GlassButton></div>
    </div> : <div className="space-y-2.5">
      <div className="flex items-center justify-between"><label className="text-xs font-bold uppercase tracking-[.18em] text-[var(--text-muted)]">Content</label><span className="text-xs text-[var(--text-muted)]">{settings.value.length} chars</span></div>
      <textarea rows={6} value={settings.value} onChange={e=>setSettings(prev=>({...prev,value:e.target.value}))} placeholder="https://example.com" className="w-full resize-y rounded-[24px] border border-white/10 bg-black/10 px-4 py-4 text-sm leading-7 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/60 focus:border-cyan-300/35" />
      {!isValid && <p className="text-sm text-rose-300">Enter some content to generate your QR code.</p>}
    </div>}

    {error && <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4"><div className="flex justify-between text-xs font-semibold text-[var(--text-muted)]"><span>QR size</span><span>{settings.size}px</span></div><input type="range" min="128" max="1024" value={settings.size} onChange={e=>setSettings(prev=>({...prev,size:Number(e.target.value)}))} className="mt-4 w-full accent-cyan-300"/></div>
      <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4"><label className="text-xs font-semibold text-[var(--text-muted)]">Error correction</label><select value={settings.errorCorrectionLevel} onChange={e=>setSettings(prev=>({...prev,errorCorrectionLevel:e.target.value as 'L'|'M'|'Q'|'H'}))} className="mt-3 w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-[var(--text)]"><option value="L">Low · L</option><option value="M">Medium · M</option><option value="Q">Quartile · Q</option><option value="H">High · H</option></select></div>
    </div>
    <div className="flex flex-wrap gap-3"><GlassButton type="button" className="bg-white text-slate-950 shadow-xl" disabled={!isValid || encoding}>Generate QR</GlassButton><GlassButton type="button" onClick={reset}><RotateCcw size={14}/> Reset</GlassButton></div>
  </div>;
}

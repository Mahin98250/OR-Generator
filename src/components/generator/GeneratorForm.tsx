import { useMemo } from 'react';
import { Link2, RotateCcw } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { useGenerator } from './GeneratorContext';

export function GeneratorForm() {
  const { settings, setSettings } = useGenerator();
  const isValid = useMemo(() => settings.value.trim().length > 0, [settings.value]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300/20 to-indigo-500/25 text-cyan-200"><Link2 size={19}/></div>
        <div><h2 className="text-xl font-bold text-[var(--text)]">What should this QR contain?</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">A URL, text, contact detail, or anything else you want to encode.</p></div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between"><label className="text-xs font-bold uppercase tracking-[.18em] text-[var(--text-muted)]">Content</label><span className="text-xs text-[var(--text-muted)]">{settings.value.length} chars</span></div>
        <textarea rows={6} value={settings.value} onChange={(e)=>setSettings(prev=>({...prev,value:e.target.value}))} placeholder="https://example.com"
          className="w-full resize-y rounded-[24px] border border-white/10 bg-black/10 px-4 py-4 text-sm leading-7 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/60 focus:border-cyan-300/35 focus:bg-white/[.055] focus:ring-4 focus:ring-cyan-300/5" />
        {!isValid ? <p className="text-sm text-rose-300">Enter some content to generate your QR code.</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4"><div className="flex justify-between text-xs font-semibold text-[var(--text-muted)]"><span>QR size</span><span>{settings.size}px</span></div><input aria-label="QR size" type="range" min="128" max="1024" value={settings.size} onChange={(e)=>setSettings(prev=>({...prev,size:Number(e.target.value)}))} className="mt-4 w-full accent-cyan-300"/></div>
        <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4"><label className="text-xs font-semibold text-[var(--text-muted)]">Error correction</label><select value={settings.errorCorrectionLevel} onChange={(e)=>setSettings(prev=>({...prev,errorCorrectionLevel:e.target.value as 'L'|'M'|'Q'|'H'}))} className="mt-3 w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-[var(--text)] outline-none"><option value="L">Low · L</option><option value="M">Medium · M</option><option value="Q">Quartile · Q</option><option value="H">High · H</option></select></div>
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        <GlassButton type="button" className="bg-white text-slate-950 shadow-xl shadow-white/10" disabled={!isValid} onClick={()=>setSettings(prev=>({...prev}))}>Generate QR</GlassButton>
        <GlassButton type="button" onClick={()=>setSettings(prev=>({...prev,value:''}))}><RotateCcw size={14}/> Reset</GlassButton>
      </div>
    </div>
  );
}
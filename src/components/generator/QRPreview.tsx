import { Loader2, ScanSearch } from 'lucide-react';
import { QRCard } from './QRCard';
import { useGenerator } from './GeneratorContext';

export function QRPreview() {
  const { dataUrl, loading, error, settings } = useGenerator();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Live preview</p><h2 className="mt-1 text-xl font-bold text-[var(--text)]">Your QR code</h2></div><span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{settings.size}px</span></div>
      <QRCard>
        <div className="relative grid min-h-[390px] place-items-center overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_50%_15%,rgba(124,124,255,.16),transparent_42%),rgba(255,255,255,.025)] p-7">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_20%,rgba(255,255,255,.04)_50%,transparent_80%)]" />
          {loading ? <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]"><Loader2 className="animate-spin text-cyan-300" size={28}/><p className="text-sm">Generating…</p></div>
          : error ? <div className="space-y-4 text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] border border-white/10 bg-white/6 text-white/70"><ScanSearch size={28}/></div><p className="font-semibold text-[var(--text)]">{error}</p><p className="text-sm leading-6 text-[var(--text-muted)]">Enter content on the left to render your code.</p></div>
          : dataUrl ? <div className="relative space-y-4 text-center"><div className="rounded-[30px] bg-white p-4 shadow-2xl shadow-black/25"><img src={dataUrl} alt="Generated QR code preview" className="mx-auto w-full max-w-[310px] rounded-xl"/></div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--text-muted)]">ECC {settings.errorCorrectionLevel} · margin {settings.margin}</p></div>
          : <div className="space-y-4 text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] border border-white/10 bg-white/6 text-white/70"><ScanSearch size={28}/></div><p className="font-semibold text-[var(--text)]">Your preview will appear here</p><p className="text-sm leading-6 text-[var(--text-muted)]">Start typing to create your QR code.</p></div>}
        </div>
      </QRCard>
    </div>
  );
}
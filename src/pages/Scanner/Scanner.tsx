import { ImageUp, ScanLine, ScanBarcode, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QRScanner } from '../../components/scanner/QRScanner';

const highlights = [
  { icon: Zap, title: 'Instant multi-format detection', text: 'Scan QR codes and common 1D/2D barcodes from the live camera.' },
  { icon: ImageUp, title: 'Photos & screenshots', text: 'Scan product labels, tickets, screenshots and saved images.' },
  { icon: ShieldCheck, title: 'Private by design', text: 'Decoding happens locally in your browser instead of uploading scans.' },
];

export function Scanner() {
  return (
    <section className="scanner-page mx-auto max-w-6xl py-8 sm:py-12">
      <div className="scanner-intro relative mb-7 overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-glass backdrop-blur-2xl sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-[-100px] h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative">
          <Link to="/" className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">Back to home</Link>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-[var(--text-muted)]">
              <ScanLine size={14} className="text-cyan-300" /> Smart Scanner
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> QR + Barcode
            </span>
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-[-.045em] text-[var(--text)] sm:text-6xl">
            One scanner for <span className="text-gradient">everything.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
            Scan QR codes and common product or industrial barcodes with your camera, a screenshot, or an uploaded photo. No second scanner app needed.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[var(--text-muted)]">
            <span className="glass-soft inline-flex items-center gap-1.5 rounded-full px-3 py-2"><ScanLine size={13} /> QR codes</span>
            <span className="glass-soft inline-flex items-center gap-1.5 rounded-full px-3 py-2"><ScanBarcode size={13} /> EAN / UPC</span>
            <span className="glass-soft rounded-full px-3 py-2">Code 128 / 39</span>
            <span className="glass-soft rounded-full px-3 py-2">Data Matrix</span>
            <span className="glass-soft rounded-full px-3 py-2">PDF417</span>
            <span className="glass-soft rounded-full px-3 py-2">Flashlight + zoom</span>
          </div>
        </div>
      </div>

      <QRScanner />

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {highlights.map(({ icon: Icon, title, text }) => (
          <div key={title} className="glass-panel rounded-[26px] p-5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300/15 to-indigo-500/15 text-cyan-300">
              <Icon size={19} />
            </span>
            <h2 className="mt-4 font-bold text-[var(--text)]">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{text}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-[24px] border border-[var(--border)] bg-[var(--bg-soft)] p-4 text-xs leading-5 text-[var(--text-muted)]">
        <Sparkles className="shrink-0 text-cyan-300" size={16} />
        <span><strong className="text-[var(--text)]">Tip:</strong> Install OptiCode Studio as a PWA for a more app-like experience.</span>
      </div>
    </section>
  );
}

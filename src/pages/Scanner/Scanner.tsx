import { ImageUp, ScanLine, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QRScanner } from '../../components/scanner/QRScanner';

const highlights = [
  { icon: Zap, title: 'Instant detection', text: 'Live camera scanning with a fast local decoding loop.' },
  { icon: ImageUp, title: 'Scan screenshots', text: 'Upload or drag in QR images from your gallery.' },
  { icon: ShieldCheck, title: 'Private by design', text: 'Decoded content stays in your browser.' },
];

export function Scanner() {
  return (
    <section className="mx-auto max-w-6xl py-8 sm:py-12">
      <div className="relative mb-7 overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-glass backdrop-blur-2xl sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-[-100px] h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative">
          <Link to="/" className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">Back to home</Link>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-[var(--text-muted)]">
              <ScanLine size={14} className="text-cyan-300" /> QR Scanner
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Ready to scan
            </span>
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-[-.045em] text-[var(--text)] sm:text-6xl">
            Scan <span className="text-gradient">any QR code.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
            Point your camera at a QR code, upload a screenshot, or drag in an image. Results can be copied, saved, or opened instantly.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[var(--text-muted)]">
            <span className="glass-soft rounded-full px-3 py-2">Camera</span>
            <span className="glass-soft rounded-full px-3 py-2">Gallery</span>
            <span className="glass-soft rounded-full px-3 py-2">Flashlight</span>
            <span className="glass-soft rounded-full px-3 py-2">Camera switch</span>
            <span className="glass-soft rounded-full px-3 py-2">Zoom</span>
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
        <span><strong className="text-[var(--text)]">Tip:</strong> Install OR-Generator as a PWA for a more app-like experience.</span>
      </div>
    </section>
  );
}

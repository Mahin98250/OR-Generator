import { ScanLine } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { QRScanner } from '../../components/scanner/QRScanner';

export function Scanner() {
  return (
    <section className="mx-auto max-w-5xl py-8 sm:py-10">
      <div className="mb-6 space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium tracking-[0.2em] text-white/65 uppercase backdrop-blur-xl">
          <ScanLine size={14} /> Scanner
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Scan a QR code.</h1>
        <p className="max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
          Use your camera or upload an image. Decoding happens locally in your browser.
        </p>
      </div>
      <GlassCard>
        <QRScanner />
      </GlassCard>
    </section>
  );
}

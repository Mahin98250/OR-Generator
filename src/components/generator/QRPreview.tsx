import { Loader2, ScanSearch } from 'lucide-react';
import { QRCard } from './QRCard';
import { useGenerator } from './GeneratorContext';

export function QRPreview() {
  const { dataUrl, loading, error, settings } = useGenerator();

  return (
    <div className="flex min-h-full flex-col gap-5">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Preview</h2>
        <p className="text-sm text-white/60">The QR updates live as you type.</p>
      </div>

      <QRCard>
        <div className="grid min-h-[360px] place-items-center rounded-[26px] border border-dashed border-white/12 bg-[radial-gradient(circle_at_top,rgba(109,124,255,0.12),transparent_42%),rgba(255,255,255,0.04)] p-8">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-white/70">
              <Loader2 className="animate-spin" size={28} />
              <p className="text-sm">Generating QR...</p>
            </div>
          ) : error ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/6 shadow-glass backdrop-blur-xl">
                <ScanSearch size={28} className="text-white/70" />
              </div>
              <div>
                <p className="text-lg font-medium text-white">{error}</p>
                <p className="mt-2 text-sm leading-7 text-white/60">Enter a valid value in the generator panel to render the preview.</p>
              </div>
            </div>
          ) : dataUrl ? (
            <div className="space-y-4 text-center">
              <img
                src={dataUrl}
                alt="Generated QR code preview"
                className="mx-auto w-full max-w-[320px] rounded-[24px] border border-white/10 bg-white p-3 shadow-glass"
              />
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Size {settings.size}px · ECC {settings.errorCorrectionLevel}</p>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/6 shadow-glass backdrop-blur-xl">
                <ScanSearch size={28} className="text-white/70" />
              </div>
              <div>
                <p className="text-lg font-medium text-white">Your QR preview will appear here</p>
                <p className="mt-2 text-sm leading-7 text-white/60">We are building the generator foundation first, then wiring in export tools.</p>
              </div>
            </div>
          )}
        </div>
      </QRCard>
    </div>
  );
}
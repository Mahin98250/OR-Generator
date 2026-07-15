import { ScanSearch } from 'lucide-react';

export function QRPreview() {
  return (
    <div className="flex min-h-full flex-col gap-5">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Preview</h2>
        <p className="text-sm text-white/60">The live QR rendering engine will connect in Phase 2.2.</p>
      </div>

      <div className="grid flex-1 place-items-center rounded-[26px] border border-dashed border-white/12 bg-[radial-gradient(circle_at_top,rgba(109,124,255,0.12),transparent_42%),rgba(255,255,255,0.04)] p-8">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[30px] border border-white/10 bg-white/6 shadow-glass backdrop-blur-xl">
            <ScanSearch size={30} className="text-white/75" />
          </div>
          <div>
            <p className="text-lg font-medium text-white">Your QR preview will appear here</p>
            <p className="mt-2 text-sm leading-7 text-white/60">
              We are building the generator foundation first, then wiring in the real QR engine and export tools.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
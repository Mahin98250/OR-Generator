import { Sparkles } from 'lucide-react';

export function EmptyPreview() {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-[26px] border border-dashed border-white/12 bg-[radial-gradient(circle_at_top,rgba(109,124,255,0.12),transparent_42%),rgba(255,255,255,0.04)] p-8 text-center">
      <div className="space-y-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/6 shadow-glass backdrop-blur-xl">
          <Sparkles size={28} className="text-white/70" />
        </div>
        <div>
          <p className="text-lg font-medium text-white">Start typing to build your QR</p>
          <p className="mt-2 text-sm leading-7 text-white/60">
            This clean preview area will be replaced by the live QR engine in Phase 2.2.
          </p>
        </div>
      </div>
    </div>
  );
}
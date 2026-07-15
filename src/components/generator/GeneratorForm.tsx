import { GlassButton } from '../ui/GlassButton';

export function GeneratorForm() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-white">QR content</h2>
        <p className="text-sm text-white/60">Generator controls will be connected in the next phase.</p>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-white/75">Text or URL</label>
        <textarea
          rows={5}
          placeholder="https://example.com"
          className="w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/75">QR size</label>
          <input
            type="range"
            min="128"
            max="1024"
            defaultValue="512"
            className="w-full accent-white"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/75">Error correction</label>
          <select className="w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none">
            <option>Low</option>
            <option>Medium</option>
            <option>Quartile</option>
            <option>High</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <GlassButton className="bg-white text-slate-950">Generate QR</GlassButton>
        <GlassButton>Reset</GlassButton>
      </div>
    </div>
  );
}
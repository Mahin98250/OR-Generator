import { GlassButton } from '../ui/GlassButton';
import { useGenerator } from './GeneratorContext';

export function GeneratorForm() {
  const { settings, setSettings } = useGenerator();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-white">QR content</h2>
        <p className="text-sm text-white/60">Edit the payload and watch the QR update instantly.</p>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-white/75">Text or URL</label>
        <textarea
          rows={5}
          value={settings.value}
          onChange={(e) => setSettings((prev) => ({ ...prev, value: e.target.value }))}
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
            value={settings.size}
            onChange={(e) => setSettings((prev) => ({ ...prev, size: Number(e.target.value) }))}
            className="w-full accent-white"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/75">Error correction</label>
          <select
            value={settings.errorCorrectionLevel}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                errorCorrectionLevel: e.target.value as 'L' | 'M' | 'Q' | 'H',
              }))
            }
            className="w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="L">Low</option>
            <option value="M">Medium</option>
            <option value="Q">Quartile</option>
            <option value="H">High</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <GlassButton type="button" className="bg-white text-slate-950">Generate QR</GlassButton>
        <GlassButton type="button" onClick={() => setSettings((prev) => ({ ...prev, value: '' }))}>Reset</GlassButton>
      </div>
    </div>
  );
}
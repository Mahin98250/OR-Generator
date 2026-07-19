import { useGenerator } from './GeneratorContext';
import { GlassButton } from '../ui/GlassButton';

export function GeneratorControls() {
  const { settings, setSettings } = useGenerator();

  return (
    <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white/75">Preset</label>
        <select
          value="custom"
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'url') {
              setSettings((prev) => ({ ...prev, value: 'https://example.com' }));
            }
            if (value === 'text') {
              setSettings((prev) => ({ ...prev, value: 'Hello from OR-Generator' }));
            }
          }}
          className="w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
        >
          <option value="custom">Custom</option>
          <option value="url">URL</option>
          <option value="text">Text</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/75">Margin</label>
          <input
            type="range"
            min="0"
            max="8"
            value={settings.margin}
            onChange={(e) => setSettings((prev) => ({ ...prev, margin: Number(e.target.value) }))}
            className="w-full accent-white"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/75">Size</label>
          <input
            type="range"
            min="128"
            max="1024"
            value={settings.size}
            onChange={(e) => setSettings((prev) => ({ ...prev, size: Number(e.target.value) }))}
            className="w-full accent-white"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <GlassButton type="button" className="bg-white text-slate-950" onClick={() => setSettings((prev) => ({ ...prev, value: 'https://example.com' }))}>
          Reset URL
        </GlassButton>
        <GlassButton type="button" onClick={() => setSettings((prev) => ({ ...prev, value: '' }))}>
          Clear
        </GlassButton>
      </div>
    </div>
  );
}
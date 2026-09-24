import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassButton } from '../../components/ui/GlassButton';
import { useTheme } from '../../components/providers/ThemeProvider';
import { clearHistory } from '../../lib/storage';

export function Settings() {
  const { theme, setTheme } = useTheme();
  const [cleared, setCleared] = useState(false);

  return (
    <section className="mx-auto max-w-4xl py-8 sm:py-10">
      <div className="mb-6 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Settings</h1>
        <p className="text-sm leading-7 text-white/65 sm:text-base">
          Control the local app preferences without an account or backend.
        </p>
      </div>

      <div className="space-y-6">
        <GlassCard>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Appearance</h2>
              <p className="mt-1 text-sm text-white/55">Choose how OR-Generator follows your device theme.</p>
            </div>
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as 'light' | 'dark' | 'system')}
              className="w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Local history</h2>
              <p className="mt-1 text-sm text-white/55">Delete saved QR payloads stored in this browser.</p>
            </div>
            <GlassButton
              type="button"
              onClick={() => {
                clearHistory();
                setCleared(true);
              }}
              className="gap-2"
            >
              <Trash2 size={14} /> Clear history
            </GlassButton>
          </div>
          {cleared ? <p className="mt-3 text-sm text-emerald-200">History cleared on this device.</p> : null}
        </GlassCard>
      </div>
    </section>
  );
}

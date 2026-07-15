import { GlassCard } from '../../components/ui/GlassCard';

export function Settings() {
  return (
    <section className="mx-auto max-w-4xl py-10">
      <GlassCard>
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-white/65">Theme controls, privacy settings, and app preferences will live here.</p>
        </div>
      </GlassCard>
    </section>
  );
}
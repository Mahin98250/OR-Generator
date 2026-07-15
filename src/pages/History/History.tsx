import { GlassCard } from '../../components/ui/GlassCard';

export function History() {
  return (
    <section className="mx-auto max-w-4xl py-10">
      <GlassCard>
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold text-white">History</h1>
          <p className="text-sm text-white/65">Saved QR items and scan results will appear here in the next sprint.</p>
        </div>
      </GlassCard>
    </section>
  );
}
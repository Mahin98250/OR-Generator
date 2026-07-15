import { GlassCard } from '../../components/ui/GlassCard';

export function Scanner() {
  return (
    <section className="mx-auto max-w-4xl py-10">
      <GlassCard>
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold text-white">QR Scanner</h1>
          <p className="text-sm text-white/65">Camera scanning and image upload support will be added in Sprint 3.</p>
        </div>
      </GlassCard>
    </section>
  );
}
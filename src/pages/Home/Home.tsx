import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';

export function Home() {
  return (
    <section className="mx-auto grid min-h-[68vh] max-w-6xl place-items-center py-10">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 backdrop-blur-xl">
            <Sparkles size={14} /> Offline-first QR experience
          </span>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              Generate and scan QR codes with a premium glass interface.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
              OR-Generator is designed for speed, clarity, and polish. Sprint 1 sets the stage for a modern offline-first QR tool with a flagship-product feel.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/generator" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 shadow-glass transition hover:scale-[1.02]">
              Start creating <ArrowRight size={14} />
            </Link>
            <Link to="/scanner" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-xl transition hover:bg-white/10">
              Open scanner
            </Link>
          </div>
        </div>

        <GlassCard>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 text-white shadow-glass">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Secure and offline-friendly</p>
                <p className="text-sm text-white/55">Built for fast local workflows</p>
              </div>
            </div>
            <div className="h-56 rounded-[24px] border border-dashed border-white/10 bg-[radial-gradient(circle_at_top,rgba(109,124,255,0.25),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
              <div className="grid h-full place-items-center rounded-[20px] border border-white/10 bg-black/20 text-center text-sm text-white/60 backdrop-blur-xl">
                Premium generator preview coming in Sprint 2
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
import { motion } from 'framer-motion';
import { AppRouter } from './router/AppRouter';
import { ArrowRight, ScanLine, Sparkles } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(120,119,198,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80 blur-3xl">
        <div className="absolute left-[-10%] top-[-8%] h-72 w-72 rounded-full bg-cyan-400/20 animate-float-slow" />
        <div className="absolute right-[-8%] top-[18%] h-80 w-80 rounded-full bg-violet-500/20 animate-float-medium" />
        <div className="absolute bottom-[-12%] left-[30%] h-96 w-96 rounded-full bg-blue-400/10 animate-float-slow" />
      </div>

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 shadow-glass backdrop-blur-xl">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 text-white shadow-lg shadow-cyan-500/20">
            <ScanLine size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-white">OR-Generator</p>
            <p className="text-xs text-white/60">Offline-first QR tools</p>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 backdrop-blur-xl">
            <Sparkles size={14} /> Premium UI
          </span>
          <a className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 shadow-glass transition-transform hover:scale-[1.02]" href="/generator">
            Open app <ArrowRight size={14} />
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="rounded-[28px] border border-white/10 bg-white/8 p-4 shadow-glass backdrop-blur-2xl sm:p-6"
        >
          <AppRouter />
        </motion.div>
      </main>
    </div>
  );
}
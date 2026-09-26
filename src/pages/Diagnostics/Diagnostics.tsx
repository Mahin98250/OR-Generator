import { useState } from 'react';
import { CheckCircle2, CircleAlert, FlaskConical, Play, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassButton } from '../../components/ui/GlassButton';
import { GlassCard } from '../../components/ui/GlassCard';
import { runProtocolDiagnostics, type ProtocolDiagnosticResult } from '../../lib/protocolSelfTest';

export function Diagnostics() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProtocolDiagnosticResult[]>([]);

  async function run() {
    setRunning(true);
    setResults([]);
    try {
      setResults(await runProtocolDiagnostics());
    } finally {
      setRunning(false);
    }
  }

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  return (
    <section className="diagnostics-page mx-auto max-w-5xl py-8 sm:py-12">
      <Link to="/" className="text-xs font-semibold text-[var(--text-muted)]">Back home</Link>
      <div className="mt-5 rounded-[32px] border border-cyan-300/15 bg-[var(--bg-elevated)] p-6 shadow-glass backdrop-blur-2xl sm:p-9">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-cyan-200">
            <FlaskConical size={14} /> Protocol diagnostics
          </span>
          {results.length > 0 && (
            <span className={failed === 0 ? 'rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300' : 'rounded-full bg-rose-400/10 px-3 py-1.5 text-xs font-bold text-rose-300'}>
              {passed}/{results.length} passed
            </span>
          )}
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-[-.045em] sm:text-6xl">Test the optical engine.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
          Runs browser-side protocol, fountain-recovery, OptiFrame, worker, multi-lane, scanner, and parser tests. These are deterministic software tests; physical throughput still requires a real screen-to-camera run.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <GlassButton onClick={() => void run()} disabled={running}>
            {running ? <RotateCcw size={15} className="animate-spin" /> : <Play size={15} />}
            {running ? 'Running diagnostics…' : 'Run full diagnostics'}
          </GlassButton>
          <Link to="/transfer" className="inline-flex min-h-10 items-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--text)]">
            Open physical transfer test
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="glass-soft rounded-[24px] p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Tests</p><p className="mt-1 text-2xl font-black text-[var(--text)]">{results.length}</p></div>
        <div className="glass-soft rounded-[24px] p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Passed</p><p className="mt-1 text-2xl font-black text-emerald-300">{passed}</p></div>
        <div className="glass-soft rounded-[24px] p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Failed</p><p className="mt-1 text-2xl font-black text-rose-300">{failed}</p></div>
      </div>

      <div className="mt-5 space-y-3">
        {results.map((result) => (
          <GlassCard key={result.name}>
            <div className="flex items-start gap-3">
              {result.passed ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-300" /> : <CircleAlert size={20} className="mt-0.5 shrink-0 text-rose-300" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[var(--text)]">{result.name}</p>
                  <span className="text-[10px] font-semibold text-[var(--text-muted)]">{result.durationMs} ms</span>
                </div>
                <p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{result.detail}</p>
              </div>
            </div>
          </GlassCard>
        ))}
        {results.length === 0 && (
          <GlassCard>
            <div className="py-10 text-center">
              <FlaskConical size={28} className="mx-auto text-cyan-300" />
              <p className="mt-3 text-sm font-bold text-[var(--text)]">No run yet</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Start the full diagnostics suite to exercise the transfer engine.</p>
            </div>
          </GlassCard>
        )}
      </div>
    </section>
  );
}

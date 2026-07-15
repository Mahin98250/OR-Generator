import { Navigate, Route, Routes } from 'react-router-dom';
import { Home } from '../pages/Home/Home';
import { History } from '../pages/History/History';
import { Scanner } from '../pages/Scanner/Scanner';
import { Settings } from '../pages/Settings/Settings';
import { GlassCard } from '../components/ui/GlassCard';

function Generator() {
  return (
    <section className="mx-auto grid min-h-[68vh] max-w-5xl place-items-center py-10">
      <GlassCard>
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-5xl">QR Generator</h1>
          <p className="text-sm leading-7 text-white/65 sm:text-base">
            The full QR generator workspace will be built in Sprint 2 with live preview, export, copy, and history.
          </p>
        </div>
      </GlassCard>
    </section>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/generator" element={<Generator />} />
      <Route path="/scanner" element={<Scanner />} />
      <Route path="/history" element={<History />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
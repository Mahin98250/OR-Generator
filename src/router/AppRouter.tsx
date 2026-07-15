import { Navigate, Route, Routes } from 'react-router-dom';

function SimplePage({ title, description }: { title: string; description: string }) {
  return (
    <section className="grid min-h-[70vh] place-items-center px-4 py-12 text-center">
      <div className="max-w-2xl rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-glass backdrop-blur-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-white/68 sm:text-base">{description}</p>
      </div>
    </section>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/"
        element={<SimplePage title="Generate and scan QR codes in style." description="Sprint 1 sets up the premium shell. Sprint 2 will unlock generator features, export options, and QR history." />}
      />
      <Route
        path="/generator"
        element={<SimplePage title="QR Generator" description="A premium offline-first generator screen will be built here in the next batch." />}
      />
      <Route
        path="/scanner"
        element={<SimplePage title="QR Scanner" description="This route will host the camera and image-based scanner UI." />}
      />
      <Route
        path="/history"
        element={<SimplePage title="History" description="Saved QR items and scan results will live here." />}
      />
      <Route
        path="/settings"
        element={<SimplePage title="Settings" description="Theme, privacy, accessibility, and app preferences." />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
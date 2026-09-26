import type { ReactNode } from 'react';
import { Footer } from './Footer';
import { Navbar } from './Navbar';

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell flex min-h-[100dvh] min-w-0 flex-col overflow-x-clip">
      <Navbar />
      <main className="app-main min-w-0 flex-1 px-3 pb-24 pt-2 sm:px-5 sm:pb-10 md:px-6 md:pt-4 lg:px-8">
        <div className="min-w-0">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

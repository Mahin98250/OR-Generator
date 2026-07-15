import type { ReactNode } from 'react';

export function QRCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-glass backdrop-blur-xl sm:p-5">
      {children}
    </div>
  );
}
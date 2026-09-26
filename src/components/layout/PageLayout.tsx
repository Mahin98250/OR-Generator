import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { Navbar } from './Navbar';

const pageMotion = {
  initial: { opacity: 0, y: 8, scale: 0.998 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.999 },
};

export function PageLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="app-shell flex min-h-[100dvh] min-w-0 flex-col overflow-x-clip">
      <Navbar />
      <main className="app-main min-w-0 flex-1 px-3 pb-24 pt-2 sm:px-5 sm:pb-10 md:px-6 md:pt-4 lg:px-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageMotion}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0 will-change-transform"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}

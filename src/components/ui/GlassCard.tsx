import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function GlassCard({ children }: { children: ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="glass-panel min-w-0 overflow-hidden rounded-[24px] p-4 shadow-glass sm:rounded-[30px] sm:p-6"
    >
      {children}
    </motion.div>
  );
}

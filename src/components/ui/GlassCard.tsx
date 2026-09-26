import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function GlassCard({ children }: { children: ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.002 }}
      whileTap={{ scale: 0.997 }}
      transition={{
        type: 'spring',
        stiffness: 320,
        damping: 30,
        mass: 0.55,
      }}
      className="glass-panel min-w-0 overflow-hidden rounded-[24px] p-4 shadow-glass sm:rounded-[30px] sm:p-6"
    >
      {children}
    </motion.div>
  );
}

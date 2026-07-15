import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function GlassCard({ children }: { children: ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      className="glass-panel rounded-[28px] p-5 shadow-glass"
    >
      {children}
    </motion.div>
  );
}
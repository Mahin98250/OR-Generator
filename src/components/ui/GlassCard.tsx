import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function GlassCard({ children }: { children: ReactNode }) {
  return (
    <motion.div whileHover={{ y:-2 }} transition={{ type:'spring', stiffness:280, damping:24 }} className="glass-panel rounded-[30px] p-5 shadow-glass sm:p-6">
      {children}
    </motion.div>
  );
}
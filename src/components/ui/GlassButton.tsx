import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

type Props = HTMLMotionProps<'button'> & {
  children: ReactNode;
};

export function GlassButton({ children, className = '', type = 'button', ...props }: Props) {
  return (
    <motion.button
      type={type}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`inline-flex items-center justify-center rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-glass backdrop-blur-xl transition ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
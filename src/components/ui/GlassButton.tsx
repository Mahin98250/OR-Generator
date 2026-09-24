import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

type Props = HTMLMotionProps<'button'> & { children: ReactNode };

export function GlassButton({ children, className='', type='button', ...props }: Props) {
  return (
    <motion.button type={type} whileHover={{ y:-1, scale:1.015 }} whileTap={{ scale:.975 }}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_10px_30px_rgba(0,0,0,.12)] backdrop-blur-xl transition hover:bg-white/14 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/60 ${className}`}
      {...props}>{children}</motion.button>
  );
}
import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

type Props = HTMLMotionProps<'button'> & { children: ReactNode };

export function GlassButton({ children, className = '', type = 'button', ...props }: Props) {
  return (
    <motion.button
      type={type}
      whileHover={{ y: -1, scale: 1.012 }}
      whileTap={{ scale: 0.965, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 460,
        damping: 34,
        mass: 0.42,
      }}
      className={`group relative inline-flex min-h-10 items-center justify-center gap-2 overflow-hidden rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_10px_30px_rgba(0,0,0,.12)] backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 hover:bg-white/14 hover:shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_14px_36px_rgba(0,0,0,.16)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/60 ${className}`}
      {...props}
    >
      <span className="pointer-events-none absolute inset-y-0 left-[-70%] w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/12 to-transparent opacity-0 transition-[left,opacity] duration-500 group-hover:left-[125%] group-hover:opacity-100" />
      <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
    </motion.button>
  );
}

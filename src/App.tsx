import { motion } from 'framer-motion';
import { AnimatedBackground } from './components/background/AnimatedBackground';
import { PageLayout } from './components/layout/PageLayout';
import { ThemeProvider } from './components/providers/ThemeProvider';
import { AppRouter } from './router/AppRouter';

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
        <AnimatedBackground />
        <PageLayout>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="rounded-[28px] border border-white/10 bg-white/8 p-4 shadow-glass backdrop-blur-2xl sm:p-6"
          >
            <AppRouter />
          </motion.div>
        </PageLayout>
      </div>
    </ThemeProvider>
  );
}
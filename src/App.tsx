import { motion } from 'framer-motion';
import { AnimatedBackground } from './components/background/AnimatedBackground';
import { PageLayout } from './components/layout/PageLayout';
import { ThemeProvider } from './components/providers/ThemeProvider';
import { AppRouter } from './router/AppRouter';

export default function App() {
  return (
    <ThemeProvider>
      <div className="relative min-h-screen overflow-x-hidden bg-[var(--bg)] text-[var(--text)]">
        <AnimatedBackground />
        <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-[var(--bg)]/80 to-transparent" />
        <PageLayout>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, ease:'easeOut' }} className="relative z-10">
            <AppRouter />
          </motion.div>
        </PageLayout>
      </div>
    </ThemeProvider>
  );
}
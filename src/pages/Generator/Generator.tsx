import { motion } from 'framer-motion';
import { GlassCard } from '../../components/ui/GlassCard';
import { GeneratorForm } from '../../components/generator/GeneratorForm';
import { QRPreview } from '../../components/generator/QRPreview';
import { GeneratorProvider } from '../../components/generator/GeneratorContext';
import { QRCodeActions } from '../../components/generator/QRCodeActions';

export function Generator() {
  return (
    <GeneratorProvider>
      <section className="mx-auto max-w-7xl py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="mb-6 space-y-3"
        >
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium tracking-[0.2em] text-white/65 uppercase backdrop-blur-xl">
            Generator Studio
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Create a QR code with a premium workflow.</h1>
          <p className="max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
            Build, preview, and refine QR content inside a polished offline-first workspace designed for speed and clarity.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <GlassCard>
            <GeneratorForm />
          </GlassCard>

          <div className="space-y-6">
            <GlassCard>
              <QRPreview />
            </GlassCard>
            <GlassCard>
              <QRCodeActions />
            </GlassCard>
          </div>
        </div>
      </section>
    </GeneratorProvider>
  );
}
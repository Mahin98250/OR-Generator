import { createContext, useContext, type ReactNode } from 'react';
import { useQRCode } from '../../hooks/useQRCode';

type GeneratorState = ReturnType<typeof useQRCode>;

const GeneratorContext = createContext<GeneratorState | null>(null);

export function GeneratorProvider({ children }: { children: ReactNode }) {
  const qr = useQRCode({
    value: 'https://example.com',
    size: 512,
    margin: 2,
    dark: '#0B1020',
    light: '#FFFFFF',
    errorCorrectionLevel: 'M',
  });

  return <GeneratorContext.Provider value={qr}>{children}</GeneratorContext.Provider>;
}

export function useGenerator() {
  const context = useContext(GeneratorContext);
  if (!context) {
    throw new Error('useGenerator must be used within GeneratorProvider');
  }
  return context;
}
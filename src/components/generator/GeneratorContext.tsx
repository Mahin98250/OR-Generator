import { createContext, useContext, useMemo } from 'react';
import { useQRCode } from '../../hooks/useQRCode';
import { buildQrSettings } from '../../utils/qrHelpers';

const GeneratorContext = createContext<ReturnType<typeof useQRCode> | null>(null);

export function GeneratorProvider({ children }: { children: React.ReactNode }) {
  const qr = useQRCode({
    value: 'https://openai.com',
  });

  const value = useMemo(() => ({ ...qr, setSettings: qr.setSettings, buildQrSettings }), [qr]);

  return <GeneratorContext.Provider value={value as ReturnType<typeof useQRCode>}>{children}</GeneratorContext.Provider>;
}

export function useGenerator() {
  const context = useContext(GeneratorContext);
  if (!context) {
    throw new Error('useGenerator must be used within GeneratorProvider');
  }
  return context;
}
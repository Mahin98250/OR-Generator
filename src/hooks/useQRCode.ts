import { useEffect, useState } from 'react';
import { isValidQrValue, toQrDataUrl, type QRSettings } from '../lib/qr';

const defaultSettings: QRSettings = {
  value: 'https://example.com',
  size: 512,
  margin: 2,
  dark: '#0B1020',
  light: '#FFFFFF',
  errorCorrectionLevel: 'M',
};

export function useQRCode(initial?: Partial<QRSettings>) {
  const [settings, setSettings] = useState<QRSettings>({ ...defaultSettings, ...initial });
  const [dataUrl, setDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      if (!isValidQrValue(settings.value)) {
        setDataUrl('');
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const next = await toQrDataUrl(settings);
        if (!cancelled) setDataUrl(next);
      } catch {
        if (!cancelled) setError('Unable to generate QR code right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void generate();
    return () => {
      cancelled = true;
    };
  }, [settings]);

  return { settings, setSettings, dataUrl, loading, error };
}
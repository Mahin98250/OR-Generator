import type { QRSettings } from '../lib/qr';

export function buildQrSettings(input: Partial<QRSettings> & { value: string }): QRSettings {
  return {
    value: input.value,
    size: input.size ?? 512,
    margin: input.margin ?? 2,
    dark: input.dark ?? '#0B1020',
    light: input.light ?? '#FFFFFF',
    errorCorrectionLevel: input.errorCorrectionLevel ?? 'M',
  };
}

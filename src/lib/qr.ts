import QRCode from 'qrcode';

export type QRSettings = {
  value: string;
  size: number;
  margin: number;
  dark: string;
  light: string;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
};

export async function toQrDataUrl(settings: QRSettings): Promise<string> {
  return QRCode.toDataURL(settings.value, {
    width: settings.size,
    margin: settings.margin,
    color: {
      dark: settings.dark,
      light: settings.light,
    },
    errorCorrectionLevel: settings.errorCorrectionLevel,
  });
}

export function isValidQrValue(value: string) {
  return value.trim().length > 0;
}

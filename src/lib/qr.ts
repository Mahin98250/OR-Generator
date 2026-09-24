import QRCode from 'qrcode';

export type QRSettings = {
  value: string;
  size: number;
  margin: number;
  dark: string;
  light: string;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
};

type RasterType = 'image/png' | 'image/jpeg';

export async function toQrDataUrl(
  settings: QRSettings,
  type: RasterType = 'image/png'
): Promise<string> {
  return QRCode.toDataURL(settings.value, {
    type,
    width: settings.size,
    margin: settings.margin,
    color: {
      dark: settings.dark,
      light: settings.light,
    },
    errorCorrectionLevel: settings.errorCorrectionLevel,
  });
}

export async function toQrSvg(settings: QRSettings): Promise<string> {
  return QRCode.toString(settings.value, {
    type: 'svg',
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

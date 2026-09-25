export const IMAGE_QR_PREFIX = 'ORIMG1:';
const MAX_PAYLOAD_CHARS = 2850;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unable to read image.')); };
    img.src = url;
  });
}

function render(img: HTMLImageElement, side: number, quality: number) {
  const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', quality),
    width,
    height,
  };
}

export async function encodeImageForQr(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Please choose an image smaller than 15 MB.');

  const img = await loadImage(file);

  // A single QR has a hard data-capacity limit. We therefore keep the original
  // pixel dimensions whenever the encoded image can fit, and otherwise find
  // the highest-resolution JPEG that fits the QR rather than always shrinking
  // to a tiny thumbnail.
  const attempts = [
    [4096, .92], [3072, .88], [2048, .84], [1600, .80],
    [1280, .76], [1024, .72], [900, .68], [800, .64],
    [700, .60], [600, .56], [512, .52], [448, .48],
    [384, .44], [320, .40], [256, .36],
  ] as const;

  for (const [side, quality] of attempts) {
    const rendered = render(img, side, quality);
    const payload = IMAGE_QR_PREFIX + rendered.dataUrl;
    if (payload.length <= MAX_PAYLOAD_CHARS) {
      const preservedDimensions = rendered.width === img.naturalWidth && rendered.height === img.naturalHeight;
      return {
        payload,
        previewUrl: rendered.dataUrl,
        width: rendered.width,
        height: rendered.height,
        originalWidth: img.naturalWidth,
        originalHeight: img.naturalHeight,
        preservedDimensions,
      };
    }
  }

  throw new Error(
    'This photo cannot fit into one QR code. A QR has a fixed data capacity; use a simpler/smaller image or a multi-QR full-resolution mode.'
  );
}

export function isImageQr(value: string) {
  return value.startsWith(IMAGE_QR_PREFIX);
}

export function decodeImageQr(value: string) {
  if (!isImageQr(value)) return null;
  const data = value.slice(IMAGE_QR_PREFIX.length);
  return data.startsWith('data:image/') ? data : null;
}

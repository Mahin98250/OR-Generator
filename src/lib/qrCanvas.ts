import QRCode from 'qrcode';

type QRModule = { size:number; data:Uint8Array | boolean[] };
type QRCodeMatrix = { modules: QRModule };

export function drawQrToCanvas(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  margin = 10,
) {
  const code = QRCode.create(value, { errorCorrectionLevel: 'L' }) as unknown as QRCodeMatrix;
  const modules = code.modules;
  const cell = (size - margin * 2) / modules.size;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#000000';

  const data = modules.data;
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      const index = row * modules.size + col;
      const dark = Array.isArray(data) ? Boolean(data[index]) : data[index] !== 0;
      if (!dark) continue;
      const left = x + margin + Math.floor(col * cell);
      const top = y + margin + Math.floor(row * cell);
      const right = x + margin + Math.floor((col + 1) * cell);
      const bottom = y + margin + Math.floor((row + 1) * cell);
      ctx.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
    }
  }
}

export function drawQrGrid(
  values: string[],
  size = 900,
  gap = 14,
) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  const cell = Math.floor((size - gap * 3) / 2);
  const positions = [
    [gap, gap],
    [gap * 2 + cell, gap],
    [gap, gap * 2 + cell],
    [gap * 2 + cell, gap * 2 + cell],
  ] as const;

  values.slice(0, 4).forEach((value, i) => {
    drawQrToCanvas(ctx, value, positions[i][0], positions[i][1], cell, 10);
  });
  return canvas.toDataURL('image/png');
}

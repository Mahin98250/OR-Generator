import { encodeOptiFrame, OPTIFRAME_SIZE, type OptiFrame } from './optiframe';

export type OptiLaneCount = 1 | 2 | 4;

export type OptiLaneLayout = {
  columns: number;
  rows: number;
};

export function getOptiLaneLayout(count: OptiLaneCount): OptiLaneLayout {
  return count === 4 ? { columns: 2, rows: 2 } : { columns: count, rows: 1 };
}

export function getOptiLaneSequence(baseSequence: number, lane: number, total: number): number {
  const sequence = baseSequence + lane;
  return total > 0 ? sequence % total : sequence;
}

export function createOptiLaneSurface(
  payloads: readonly Uint8Array[],
  baseSequence: number,
  total: number,
  laneCount: OptiLaneCount,
) {
  if (payloads.length !== laneCount) {
    throw new Error(`Expected ${laneCount} lane payloads.`);
  }

  const layout = getOptiLaneLayout(laneCount);
  const canvas = document.createElement('canvas');
  canvas.width = layout.columns * OPTIFRAME_SIZE;
  canvas.height = layout.rows * OPTIFRAME_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const frames: OptiFrame[] = [];
  for (let lane = 0; lane < laneCount; lane += 1) {
    const sequence = getOptiLaneSequence(baseSequence, lane, total);
    const encoded = encodeOptiFrame(payloads[lane], sequence, total);
    frames.push(encoded.frame);
    const x = (lane % layout.columns) * OPTIFRAME_SIZE;
    const y = Math.floor(lane / layout.columns) * OPTIFRAME_SIZE;
    ctx.drawImage(encoded.canvas, x, y);
  }

  return { canvas, frames, layout };
}

export function cropOptiLaneGrid(source: ImageData, laneCount: OptiLaneCount) {
  const layout = getOptiLaneLayout(laneCount);
  const laneWidth = Math.floor(source.width / layout.columns);
  const laneHeight = Math.floor(source.height / layout.rows);
  if (laneWidth < OPTIFRAME_SIZE || laneHeight < OPTIFRAME_SIZE) return [];

  return Array.from({ length: laneCount }, (_, lane) => {
    const col = lane % layout.columns;
    const row = Math.floor(lane / layout.columns);
    const x = col * laneWidth;
    const y = row * laneHeight;
    const width = col === layout.columns - 1 ? source.width - x : laneWidth;
    const height = row === layout.rows - 1 ? source.height - y : laneHeight;
    const image = new ImageData(width, height);
    for (let line = 0; line < height; line += 1) {
      const sourceStart = ((y + line) * source.width + x) * 4;
      image.data.set(source.data.subarray(sourceStart, sourceStart + width * 4), line * width * 4);
    }
    return { lane, image, offsetX: x, offsetY: y };
  });
}

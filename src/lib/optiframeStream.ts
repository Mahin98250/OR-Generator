import { OPTIFRAME_MAX_PAYLOAD, type OptiFrame } from './optiframe';

export type OptiFrameAssembly = {
  total: number;
  received: number;
  missing: number[];
  complete: boolean;
  bytes: number;
  payload?: Uint8Array;
};

export function splitOptiFramePayload(payload: Uint8Array, chunkSize = OPTIFRAME_MAX_PAYLOAD) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > OPTIFRAME_MAX_PAYLOAD) {
    throw new Error('Chunk size must be between 1 and the OptiFrame payload capacity.');
  }
  const total = Math.max(1, Math.ceil(payload.length / chunkSize));
  const chunks: Uint8Array[] = [];
  for (let index = 0; index < total; index++) {
    chunks.push(payload.slice(index * chunkSize, Math.min(payload.length, (index + 1) * chunkSize)));
  }
  return chunks;
}

function concat(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export class OptiFrameAssembler {
  private total = 0;
  private frames = new Map<number, Uint8Array>();
  private bytes = 0;

  reset(total = 0) {
    this.total = total;
    this.frames.clear();
    this.bytes = 0;
  }

  add(frame: OptiFrame): OptiFrameAssembly {
    const startsNewStream = !this.total || (frame.sequence === 0 && this.frames.size > 0);
    if (startsNewStream) this.reset(frame.total);

    if (frame.total !== this.total || frame.sequence < 0 || frame.sequence >= frame.total) {
      return this.snapshot();
    }

    if (!this.frames.has(frame.sequence)) {
      this.frames.set(frame.sequence, frame.payload.slice());
      this.bytes += frame.payload.length;
    }

    const missing: number[] = [];
    for (let index = 0; index < this.total; index++) {
      if (!this.frames.has(index)) missing.push(index);
    }

    const complete = missing.length === 0;
    const payload = complete
      ? concat(Array.from({ length: this.total }, (_, index) => this.frames.get(index)!))
      : undefined;

    return {
      total: this.total,
      received: this.frames.size,
      missing,
      complete,
      bytes: this.bytes,
      payload,
    };
  }

  snapshot(): OptiFrameAssembly {
    const missing: number[] = [];
    for (let index = 0; index < this.total; index++) {
      if (!this.frames.has(index)) missing.push(index);
    }
    return {
      total: this.total,
      received: this.frames.size,
      missing,
      complete: this.total > 0 && missing.length === 0,
      bytes: this.bytes,
    };
  }
}

export function utf8ToText(payload: Uint8Array) {
  return new TextDecoder().decode(payload);
}

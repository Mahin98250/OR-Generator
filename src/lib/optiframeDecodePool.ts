import type { OptiFrame, OptiFramePerspectiveDiagnostics } from './optiframe';

export type OptiFrameWorkerResult = {
  frame: OptiFrame;
  diagnostics: OptiFramePerspectiveDiagnostics;
  workerMs: number;
};

type Pending = {
  resolve: (result: OptiFrameWorkerResult | null) => void;
  reject: (error: Error) => void;
  startedAt: number;
};

type WorkerResponse = {
  id: number;
  ok: boolean;
  frame?: OptiFrame;
  diagnostics?: Omit<OptiFramePerspectiveDiagnostics, 'anchors'>;
  error?: string;
};

export class OptiFrameDecodePool {
  private readonly worker: Worker | null;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(enabled = typeof Worker !== 'undefined') {
    if (!enabled) {
      this.worker = null;
      return;
    }

    const worker = new Worker(new URL('../workers/optiframeDecoder.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const pending = this.pending.get(event.data.id);
      if (!pending) return;
      this.pending.delete(event.data.id);

      if (!event.data.ok || !event.data.frame || !event.data.diagnostics) {
        pending.resolve(null);
        return;
      }

      pending.resolve({
        frame: event.data.frame,
        diagnostics: {
          anchors: [],
          confidence: event.data.diagnostics.confidence,
          sampleWidth: event.data.diagnostics.sampleWidth,
          sampleHeight: event.data.diagnostics.sampleHeight,
          decodeMs: event.data.diagnostics.decodeMs,
        },
        workerMs: performance.now() - pending.startedAt,
      });
    };

    worker.onerror = () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error('OptiFrame decoder worker failed.'));
      }
      this.pending.clear();
    };

    this.worker = worker;
  }

  get available() {
    return this.worker !== null && this.pending.size === 0;
  }

  decode(buffer: ArrayBuffer, width: number, height: number): Promise<OptiFrameWorkerResult | null> | null {
    if (!this.worker || this.pending.size > 0) return null;

    const id = this.nextId++;
    const startedAt = performance.now();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, startedAt });
      this.worker!.postMessage({ id, width, height, buffer }, [buffer]);
    });
  }

  terminate() {
    this.worker?.terminate();
    for (const pending of this.pending.values()) {
      pending.reject(new Error('OptiFrame decoder pool terminated.'));
    }
    this.pending.clear();
  }
}

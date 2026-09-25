import { decodeOptiFramePerspective } from '../lib/optiframe';

type Request = {
  id: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
};

type Response = {
  id: number;
  ok: boolean;
  frame?: {
    version: number;
    sequence: number;
    total: number;
    payload: Uint8Array;
  };
  diagnostics?: {
    confidence: number;
    sampleWidth: number;
    sampleHeight: number;
    decodeMs: number;
  };
  error?: string;
};

const scope = self as unknown as {
  onmessage: (event: MessageEvent<Request>) => void;
  postMessage: (message: Response, transfer?: Transferable[]) => void;
};

scope.onmessage = (event) => {
  const { id, width, height, buffer } = event.data;
  try {
    const image = new ImageData(new Uint8ClampedArray(buffer), width, height);
    const result = decodeOptiFramePerspective(image);
    if (!result) {
      scope.postMessage({ id, ok: false });
      return;
    }

    const payloadBuffer = result.frame.payload.slice().buffer;
    scope.postMessage({
      id,
      ok: true,
      frame: {
        version: result.frame.version,
        sequence: result.frame.sequence,
        total: result.frame.total,
        payload: new Uint8Array(payloadBuffer),
      },
      diagnostics: {
        confidence: result.diagnostics.confidence,
        sampleWidth: result.diagnostics.sampleWidth,
        sampleHeight: result.diagnostics.sampleHeight,
        decodeMs: result.diagnostics.decodeMs,
      },
    }, [payloadBuffer]);
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'OptiFrame worker decode failed.',
    });
  }
};

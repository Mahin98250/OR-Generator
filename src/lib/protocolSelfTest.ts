import { analyzeScan } from './scan';
import { QrEncodePool } from './qrEncodePool';
import { optiFrameSelfTest } from './optiframe';
import { OptiFrameAssembler, splitOptiFramePayload, utf8ToText } from './optiframeStream';
import { OptiFrameDecodePool } from './optiframeDecodePool';
import { createFountainDecoder, createFountainTransfer, parseFountainFrame, type FountainDroplet } from './fountain';
import {
  addMultiImageChunk,
  clearMultiImage,
  encodeImageForMultiQr,
  getMultiImageMissingFrames,
  parseMultiImageQr,
  reconstructMultiImage,
} from './imageQr';
import {
  addTransferFrame,
  clearTransfer,
  createTransfer,
  getTransferMissingFrames,
  parseTransferFrame,
  reconstructTransfer,
} from './orTransfer';

export type ProtocolDiagnosticResult = {
  name: string;
  passed: boolean;
  durationMs: number;
  detail: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeBytes(length: number, seed = 37) {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = (i * 31 + seed * 17 + (i >>> 3)) % 256;
  }
  return bytes;
}

async function sha256(bytes: Uint8Array) {
  const input = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer
    : bytes.slice().buffer;
  const digest = await crypto.subtle.digest('SHA-256', input as ArrayBuffer);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function readBlobUrl(url: string) {
  const response = await fetch(url);
  return new Uint8Array(await response.arrayBuffer());
}

function expectEqualBytes(actual: Uint8Array, expected: Uint8Array, label: string) {
  assert(actual.byteLength === expected.byteLength, label + ': size mismatch (' + actual.byteLength + ' !== ' + expected.byteLength + ').');
  for (let i = 0; i < expected.length; i += 1) {
    if (actual[i] !== expected[i]) throw new Error(label + ': byte mismatch at offset ' + i + '.');
  }
}

async function runCase(name: string, fn: () => Promise<string>): Promise<ProtocolDiagnosticResult> {
  const start = performance.now();
  try {
    const detail = await fn();
    return { name, passed: true, durationMs: Math.round(performance.now() - start), detail };
  } catch (error) {
    return {
      name,
      passed: false,
      durationMs: Math.round(performance.now() - start),
      detail: error instanceof Error ? error.message : 'Unknown diagnostic error.',
    };
  }
}

function descendingByFrame<T extends { index: number }>(items: T[]) {
  return [...items].sort((a, b) => b.index - a.index);
}

async function transferRoundTrip() {
  const original = makeBytes(7_250, 91);
  const file = new File([original], 'diagnostic-transfer.bin', { type: 'application/octet-stream' });
  const plan = await createTransfer(file);

  assert(plan.total > 1, 'Transfer fixture did not produce multiple frames.');

  const frames = [];
  for (let index = 1; index <= plan.total; index += 1) {
    const raw = await plan.getFrame(index);
    const parsed = parseTransferFrame(raw);
    assert(parsed, 'Transfer frame ' + index + ' did not parse.');
    frames.push(parsed);
  }

  let duplicateObserved = false;
  for (const frame of descendingByFrame(frames)) {
    const result = await addTransferFrame(frame);
    if (result.duplicate) duplicateObserved = true;
  }

  const duplicateResult = await addTransferFrame(frames[0]);
  duplicateObserved ||= duplicateResult.duplicate;
  assert(duplicateObserved, 'Duplicate transfer frame was not detected.');

  const rebuilt = await reconstructTransfer(plan.session);
  assert(rebuilt, 'Transfer reconstruction returned no file.');

  try {
    const actual = await readBlobUrl(rebuilt.url);
    expectEqualBytes(actual, original, 'Transfer round-trip');
    assert(await sha256(actual) === plan.hash, 'Transfer SHA-256 mismatch.');
  } finally {
    URL.revokeObjectURL(rebuilt.url);
  }

  return plan.total + ' frames · out-of-order delivery · duplicate detection · exact SHA-256';
}

async function transferMissingRecovery() {
  const original = makeBytes(4_800, 53);
  const file = new File([original], 'diagnostic-missing.bin', { type: 'application/octet-stream' });
  const plan = await createTransfer(file);
  assert(plan.total > 1, 'Transfer recovery fixture did not produce multiple frames.');

  const first = parseTransferFrame(await plan.getFrame(1));
  assert(first, 'Recovery fixture frame 1 did not parse.');
  await addTransferFrame(first);

  const missing = await getTransferMissingFrames(plan.session);
  assert(missing.length === plan.total - 1, 'Expected ' + (plan.total - 1) + ' missing frames, found ' + missing.length + '.');
  assert(missing[0] === 2, 'Missing-frame ordering is incorrect.');

  await clearTransfer(plan.session);
  return missing.length + ' missing frame(s) correctly surfaced after partial receipt';
}

async function transferCorruptionDetection() {
  const original = makeBytes(5_900, 17);
  const file = new File([original], 'diagnostic-corrupt.bin', { type: 'application/octet-stream' });
  const plan = await createTransfer(file);
  assert(plan.total > 1, 'Transfer corruption fixture did not produce multiple frames.');

  for (let index = 1; index <= plan.total; index += 1) {
    const raw = await plan.getFrame(index);
    const parsed = parseTransferFrame(raw);
    assert(parsed, 'Corruption fixture frame ' + index + ' did not parse.');
    const last = parsed.data.at(-1) || 'A';
    const frame = index === 2
      ? { ...parsed, data: parsed.data.slice(0, -1) + (last === 'A' ? 'B' : 'A') }
      : parsed;
    await addTransferFrame(frame);
  }

  let rejected = false;
  try {
    await reconstructTransfer(plan.session);
  } catch (error) {
    rejected = error instanceof Error && /Integrity verification failed/.test(error.message);
  } finally {
    await clearTransfer(plan.session);
  }

  assert(rejected, 'Corrupted transfer was not rejected by integrity verification.');
  return 'Corrupted frame changed content but reconstruction rejected it via SHA-256';
}

async function multiImageRoundTrip() {
  const original = makeBytes(6_400, 73);
  const file = new File([original], 'diagnostic-photo.png', { type: 'image/png' });
  const plan = await encodeImageForMultiQr(file);

  assert(plan.total > 1, 'Multi-QR fixture did not produce multiple frames.');

  const frames: Array<{ raw: string; index: number }> = [];
  for (let index = 1; index <= plan.total; index += 1) {
    const raw = await plan.getChunk(index);
    const parsed = parseMultiImageQr(raw);
    assert(parsed, 'Multi-QR frame ' + index + ' did not parse.');
    frames.push({ raw, index: parsed.index });
  }

  for (const frame of descendingByFrame(frames)) {
    await addMultiImageChunk(frame.raw);
  }

  const duplicate = await addMultiImageChunk(frames[0].raw);
  assert(Boolean(duplicate?.duplicate), 'Duplicate Multi-QR frame was not detected.');

  const rebuilt = await reconstructMultiImage(plan.id);
  assert(rebuilt, 'Multi-QR reconstruction returned no image.');

  try {
    const actual = await readBlobUrl(rebuilt.url);
    expectEqualBytes(actual, original, 'Multi-QR round-trip');
    assert(rebuilt.name === file.name, 'Multi-QR filename was not preserved.');
    assert(await sha256(actual) === plan.hash, 'Multi-QR SHA-256 mismatch.');
  } finally {
    URL.revokeObjectURL(rebuilt.url);
  }

  return plan.total + ' frames · out-of-order delivery · original filename preserved · exact SHA-256';
}

async function fountainRoundTrip() {
  const original = makeBytes(18_400, 123);
  const file = new File([original], 'diagnostic-fountain.bin', { type: 'application/octet-stream' });
  const plan = await createFountainTransfer(file);
  assert(plan.blocks >= 10, 'Fountain fixture did not create enough source blocks.');

  const rawFrames: FountainDroplet[] = [];
  const frameCount = plan.blocks * 3;
  for (let i = 0; i < frameCount; i += 1) {
    const raw = await plan.getDroplet(i % 4, i);
    const frame = parseFountainFrame(raw);
    assert(frame, 'Fountain droplet ' + i + ' failed to parse.');
    rawFrames.push(frame);
  }

  // Simulate an optical channel: the receiver starts late, drops ~25% of
  // frames, receives out of order and sees duplicates.
  const kept = rawFrames.filter((_, index) => index >= Math.floor(frameCount * 0.15) && index % 4 !== 0);
  const reordered = [...kept].reverse();
  const duplicate = kept.slice(0, Math.min(8, kept.length));
  const delivery = [...reordered, ...duplicate];

  const first = delivery[0];
  assert(first, 'No fountain delivery fixture survived the simulated loss.');
  const decoder = createFountainDecoder(first);
  let duplicateObserved = false;
  let complete = false;

  for (const frame of delivery) {
    const result = decoder.add(frame);
    duplicateObserved ||= result.duplicate;
    complete = result.complete;
    if (complete) break;
  }

  assert(duplicateObserved, 'Fountain duplicate tolerance was not exercised.');
  const rebuilt = await decoder.reconstruct();
  assert(rebuilt, 'Fountain decoder could not reconstruct under simulated loss/out-of-order delivery.');
  expectEqualBytes(rebuilt.bytes, original, 'Fountain lossy round-trip');
  assert(rebuilt.hash === plan.hash, 'Fountain SHA-256 mismatch.');

  return plan.blocks + ' source blocks · ~25% simulated frame loss · late join · out-of-order delivery · duplicates · exact SHA-256';
}



async function fountainRecoveryStress() {
  const sizes = [9_100, 31_700, 96_400];
  let completed = 0;
  let worstSeen = 0;

  for (const size of sizes) {
    const original = makeBytes(size, size % 251);
    const file = new File([original], 'diagnostic-fountain-stress.bin', { type: 'application/octet-stream' });
    const plan = await createFountainTransfer(file);
    const count = Math.ceil(plan.blocks * 1.45);
    const frames: FountainDroplet[] = [];

    for (let i = 0; i < count; i += 1) {
      const raw = await plan.getDroplet(i % 4, i);
      const parsed = parseFountainFrame(raw);
      assert(parsed, 'Stress droplet ' + i + ' failed to parse.');
      // Deterministic optical-loss model: keep 3 of every 4 frames, then
      // scramble delivery and inject duplicates.
      if ((i * 17 + 11) % 4 !== 0) frames.push(parsed);
    }

    worstSeen = Math.max(worstSeen, frames.length);
    const shuffled = [...frames].sort((a, b) => {
      const av = (a.seed ^ (a.seed >>> 16)) >>> 0;
      const bv = (b.seed ^ (b.seed >>> 16)) >>> 0;
      return av - bv;
    });
    const delivery = [...shuffled, ...shuffled.slice(0, Math.min(12, shuffled.length))];
    const first = delivery[0];
    assert(first, 'Stress delivery was empty.');

    const decoder = createFountainDecoder(first);
    let complete = false;
    for (const frame of delivery) {
      const result = decoder.add(frame);
      complete = result.complete;
      if (complete) break;
    }

    const rebuilt = await decoder.reconstruct();
    assert(rebuilt, 'Fountain stress case failed at ' + size + ' bytes.');
    expectEqualBytes(rebuilt.bytes, original, 'Fountain stress ' + size);
    assert(rebuilt.hash === plan.hash, 'Fountain stress SHA-256 mismatch at ' + size + ' bytes.');
    assert(decoder.seen() <= delivery.length, 'Fountain duplicate accounting exceeded delivered frames.');
    completed += 1;
  }

  return completed + ' stress cases · deterministic 25% frame loss · reordering · duplicates · ' + worstSeen + ' peak delivered droplets';
}

async function fountainSeedContinuity() {
  const original = makeBytes(52_000, 201);
  const file = new File([original], 'diagnostic-fountain-sequence.bin', { type: 'application/octet-stream' });
  const plan = await createFountainTransfer(file);
  const randomSeeds = new Set<number>();
  const systematicTargets = new Set<number>();

  for (let i = 0; i < 2_000; i += 1) {
    const randomRaw = await plan.getDroplet(2, i);
    const randomFrame = parseFountainFrame(randomRaw);
    assert(randomFrame, 'Random sequence frame failed to parse.');
    assert((randomFrame.seed & 0x80000000) === 0, 'Random fountain seed crossed the systematic seed range.');
    assert(!randomSeeds.has(randomFrame.seed), 'Random fountain seed repeated at sequence ' + i + '.');
    randomSeeds.add(randomFrame.seed);

    const systematicRaw = await plan.getDroplet(0, i);
    const systematicFrame = parseFountainFrame(systematicRaw);
    assert(systematicFrame, 'Systematic sequence frame failed to parse.');
    assert(systematicFrame.degree === 1, 'Systematic lane stopped being degree-1.');
    systematicTargets.add(systematicFrame.seed & 0x7fffffff);
  }

  assert(randomSeeds.size === 2_000, 'Deterministic random seed stream repeated.');
  assert(systematicTargets.size === Math.min(plan.blocks, 1_000), 'Systematic lane did not cycle through source blocks correctly.');
  return '2,000 deterministic random seeds + systematic source coverage verified';
}

async function qrEncoderWorkerDiagnostic() {
  if (typeof Worker === 'undefined') return 'Worker API unavailable; compatibility renderer retained';
  const pool = new QrEncodePool(1);
  try {
    assert(pool.capacity >= 1, 'QR encoder worker could not be initialized.');
    const result = await pool.encode([
      'OptiCode worker diagnostic',
      'https://example.com/opticode-worker',
      'OptiCode worker diagnostic',
      'WIFI:T:WPA;S:OptiCode-Test;P:worker-pass;;',
    ]);
    assert(result.matrices.length === 4, 'QR encoder worker returned the wrong matrix count.');
    assert(result.matrices.every(matrix => matrix.size > 0 && matrix.data.length === matrix.size * matrix.size), 'QR encoder worker returned an invalid matrix.');
    assert(result.cacheHits === 1, 'QR encoder matrix cache did not hit for a repeated payload.');
    return result.cacheHits + ' cache hit · ' + result.workerJobs + ' worker job(s) · ' + Math.round(result.encodeMs) + ' ms encode pipeline';
  } finally {
    pool.dispose();
  }
}

async function optiFrameWorkerDiagnostic() {
  if (typeof Worker === 'undefined') return 'Worker API unavailable; main-thread decoder retained.';

  const payload = new TextEncoder().encode('OptiFrame worker diagnostic ✓');
  const encoded = optiFrameSelfTest();
  assert(encoded.capacityBytes > payload.length, 'OptiFrame worker fixture capacity is too small.');

  const { encodeOptiFrame } = await import('./optiframe');
  const frame = encodeOptiFrame(payload, 3, 9);
  const ctx = frame.canvas.getContext('2d', { willReadFrequently: true });
  assert(ctx, 'OptiFrame worker fixture canvas context unavailable.');
  const image = ctx.getImageData(0, 0, frame.canvas.width, frame.canvas.height);
  const pool = new OptiFrameDecodePool(true);

  try {
    const result = await pool.decode(image.data.buffer.slice(0), image.width, image.height);
    assert(result, 'OptiFrame worker returned no decoded frame.');
    assert(result.frame.sequence === 3 && result.frame.total === 9, 'OptiFrame worker metadata mismatch.');
    expectEqualBytes(result.frame.payload, payload, 'OptiFrame worker payload');
    assert(result.diagnostics.confidence > 0.7, 'OptiFrame worker confidence was unexpectedly low.');
    return 'Worker round trip · CRC-32 verified · ' + Math.round(result.workerMs) + ' ms wall time';
  } finally {
    pool.terminate();
  }
}

async function optiFrameStreamReassembly() {
  const text = 'OptiCode OptiFrame stream diagnostic · out-of-order · duplicates · UTF-8 ✓';
  const payload = new TextEncoder().encode(text.repeat(90));
  const chunks = splitOptiFramePayload(payload, 640);
  const total = chunks.length;
  const assembler = new OptiFrameAssembler();
  const order = [...chunks.keys()].reverse();
  for (const index of order) {
    const frame = { version: 1, sequence: index, total, payload: chunks[index] };
    assembler.add(frame);
  }
  const duplicate = assembler.add({ version: 1, sequence: 2, total, payload: chunks[2] });
  assert(duplicate.received === total, 'Duplicate OptiFrame altered received-frame accounting.');
  assert(duplicate.complete, 'OptiFrame stream did not reassemble after out-of-order delivery.');
  assert(duplicate.payload, 'OptiFrame stream returned no reconstructed payload.');
  assert(utf8ToText(duplicate.payload) === text.repeat(90), 'OptiFrame stream payload changed during reassembly.');
  return total + ' fragments · reverse order · duplicate tolerance · exact UTF-8 reassembly';
}

async function scanFormatCompatibility() {
  const cases = [
    { input: 'https://example.com', kind: 'url', title: 'Website' },
    { input: 'mailto:test@example.com', kind: 'email', title: 'Email address' },
    { input: 'tel:+919999999999', kind: 'phone', title: 'Phone number' },
    { input: 'WIFI:T:WPA;S:OR-Test;P:secret;;', kind: 'wifi', title: 'Wi-Fi network' },
    { input: 'upi://pay?pa=test@upi&pn=Test', kind: 'upi', title: 'UPI payment' },
    { input: 'BEGIN:VCARD\nFN:Test User\nTEL:+919999999999\nEND:VCARD', kind: 'vcard', title: 'Contact card' },
    { input: 'GEO:23.0225,72.5714', kind: 'geo', title: 'Location' },
    { input: 'BEGIN:VEVENT\nSUMMARY:Test event\nEND:VEVENT', kind: 'calendar', title: 'Calendar event' },
    { input: '9780306406157', kind: 'isbn', title: 'ISBN' },
    { input: '4006381333931', kind: 'barcode', title: 'Barcode' },
    { input: 'ORIMG1:data:image/jpeg;base64,AAAA', kind: 'image', title: 'Image QR' },
    { input: 'ORX1:test|application%2Foctet-stream|ZmlsZS5iaW4|2048|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|1|3|AAAA', kind: 'or-transfer', title: 'OR Transfer frame', actionUrl: '#/transfer' },
  ] as const;

  for (const test of cases) {
    const analysis = analyzeScan(test.input);
    assert(analysis.kind === test.kind, test.input + ': expected kind ' + test.kind + ', got ' + analysis.kind + '.');
    assert(analysis.title === test.title, test.input + ': expected title ' + test.title + ', got ' + analysis.title + '.');
    if ('actionUrl' in test && test.actionUrl) {
      assert(analysis.actionUrl === test.actionUrl, 'OR Transfer action did not point to the Transfer page.');
    }
  }

  return cases.length + ' format classifications verified locally';
}

async function multiImageMissingRecovery() {
  const original = makeBytes(4_200, 11);
  const file = new File([original], 'diagnostic-photo-missing.png', { type: 'image/png' });
  const plan = await encodeImageForMultiQr(file);
  assert(plan.total > 1, 'Multi-QR recovery fixture did not produce multiple frames.');

  await addMultiImageChunk(await plan.getChunk(1));
  const missing = await getMultiImageMissingFrames(plan.id);
  assert(missing.length === plan.total - 1, 'Expected ' + (plan.total - 1) + ' missing Multi-QR frames, found ' + missing.length + '.');
  assert(missing[0] === 2, 'Multi-QR missing-frame ordering is incorrect.');

  await clearMultiImage(plan.id);
  return missing.length + ' missing frame(s) correctly surfaced after partial receipt';
}



async function generatorScannerCompatibility() {
  const cases: Array<{ label: string; value: string; kind: string; format?: string }> = [
    { label: 'URL', value: 'https://example.com/docs?q=qr', kind: 'url', format: 'QR CODE' },
    { label: 'Email', value: 'mailto:student@example.com', kind: 'email', format: 'QR CODE' },
    { label: 'Phone', value: '+919876543210', kind: 'phone', format: 'QR CODE' },
    { label: 'Wi-Fi', value: 'WIFI:T:WPA;S:SchoolNet;P:school-pass;;', kind: 'wifi', format: 'QR CODE' },
    { label: 'UPI', value: 'upi://pay?pa=student@upi&pn=Student&am=25', kind: 'upi', format: 'QR CODE' },
    { label: 'vCard', value: 'BEGIN:VCARD\\nVERSION:3.0\\nFN:Student\\nTEL:+919876543210\\nEMAIL:student@example.com\\nEND:VCARD', kind: 'vcard', format: 'QR CODE' },
    { label: 'Geo', value: 'geo:23.0225,72.5714', kind: 'geo', format: 'QR CODE' },
    { label: 'Calendar', value: 'BEGIN:VEVENT\\nSUMMARY:Science Test\\nEND:VEVENT', kind: 'calendar', format: 'QR CODE' },
    { label: 'ISBN', value: '9780306406157', kind: 'isbn', format: 'QR CODE' },
    { label: 'Barcode', value: '012345678905', kind: 'barcode', format: 'UPC-A' },
    { label: 'Text', value: 'Hello from OR-Generator', kind: 'text', format: 'QR CODE' },
  ];

  for (const item of cases) {
    const analysis = analyzeScan(item.value, item.format);
    assert(analysis.kind === item.kind, item.label + ' classified as ' + analysis.kind + ' instead of ' + item.kind + '.');
  }

  const transfer = analyzeScan(
    'ORX1:test-session|application%2Foctet-stream|ZmlsZS5iaW4|4096|' + 'a'.repeat(64) + '|3|8|' + 'A'.repeat(20),
    'QR CODE',
  );
  assert(transfer.kind === 'or-transfer', 'OR Transfer compatibility classification failed.');

  return cases.length + ' standard payload types + OR Transfer classified correctly';
}

async function scanClassification() {
  const transferRaw = 'ORX1:diagnostic|application%2Foctet-stream|ZGlhZ25vc3RpYy5iaW4|1200|' + 'a'.repeat(64) + '|2|4|' + 'A'.repeat(1200);
  const transfer = analyzeScan(transferRaw, 'QR CODE');
  assert(transfer.kind === 'or-transfer', 'OR Transfer frames are not classified by the scanner analyzer.');
  assert(transfer.actionUrl === '#/transfer', 'OR Transfer analyzer does not provide the transfer route.');
  assert(transfer.meta.Frame === '2 / 4', 'OR Transfer frame metadata is incorrect.');

  const wifi = analyzeScan('WIFI:T:WPA;S:DiagnosticNet;P:test-pass;;', 'QR CODE');
  assert(wifi.kind === 'wifi', 'Wi-Fi payload was not classified.');

  const upi = analyzeScan('upi://pay?pa=test@upi&pn=Diagnostic&am=10', 'QR CODE');
  assert(upi.kind === 'upi', 'UPI payload was not classified.');

  const url = analyzeScan('https://example.com/path?q=qr', 'QR CODE');
  assert(url.kind === 'url' && url.actionUrl === 'https://example.com/path?q=qr', 'HTTPS URL classification failed.');

  const barcode = analyzeScan('012345678905', 'UPC-A');
  assert(barcode.kind === 'barcode', 'UPC-A payload was not classified as a barcode.');

  return 'OR Transfer + Wi-Fi + UPI + HTTPS + barcode classification passed';
}

async function parserValidation() {
  const transferMalformed = 'ORX1:session|application%2Foctet-stream|Zg|1|not-a-hash|1|1|A';
  assert(parseTransferFrame(transferMalformed) === null, 'Malformed OR Transfer hash was accepted.');

  const multiMalformed = 'ORMIMG1:session|image%2Fpng|Zm9v|not-a-hash|1|1|A';
  assert(parseMultiImageQr(multiMalformed) === null, 'Malformed Multi-QR hash was accepted.');

  const transferOversized = 'ORX1:session|application%2Foctet-stream|Zg|1|' + 'a'.repeat(64) + '|1|1|' + 'A'.repeat(1201);
  assert(parseTransferFrame(transferOversized) === null, 'Oversized OR Transfer payload was accepted.');

  return 'Malformed hashes and oversized payloads were rejected before storage';
}

export async function runProtocolDiagnostics(): Promise<ProtocolDiagnosticResult[]> {
  if (!('indexedDB' in window)) {
    return [{
      name: 'Environment',
      passed: false,
      durationMs: 0,
      detail: 'IndexedDB is unavailable in this browser; local protocol storage cannot be tested.',
    }];
  }

  return Promise.all([
    runCase('OR Transfer · round trip', transferRoundTrip),
    runCase('OR Transfer · fountain round trip', fountainRoundTrip),
    runCase('OR Transfer · fountain recovery stress', fountainRecoveryStress),
    runCase('OR Transfer · fountain seed continuity', fountainSeedContinuity),
    runCase('Performance · QR encoder worker', qrEncoderWorkerDiagnostic),
    runCase('OptiFrame · custom codec round trip', async () => { const r = optiFrameSelfTest(); return r.payloadBytes + ' payload bytes · ' + r.capacityBytes + ' byte capacity · CRC-32 verified'; }),
    runCase('OptiFrame · worker perspective decode', optiFrameWorkerDiagnostic),
    runCase('OptiFrame · multi-frame reassembly', optiFrameStreamReassembly),
    runCase('OR Transfer · missing-frame recovery', transferMissingRecovery),
    runCase('OR Transfer · corruption detection', transferCorruptionDetection),
    runCase('Multi-QR Photo · round trip', multiImageRoundTrip),
    runCase('Multi-QR Photo · missing-frame recovery', multiImageMissingRecovery),
    runCase('Scanner · Generator compatibility', generatorScannerCompatibility),
    runCase('Scanner · payload classification', scanClassification),
    runCase('Protocol · parser validation', parserValidation),
    runCase('Scanner · format compatibility', scanFormatCompatibility),
  ]);
}

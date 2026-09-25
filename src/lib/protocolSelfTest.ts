import { analyzeScan } from './scan';
import { createFountainDecoder, createFountainTransfer, parseFountainFrame } from './fountain';
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
  const original = makeBytes(9_600, 123);
  const file = new File([original], 'diagnostic-fountain.bin', { type: 'application/octet-stream' });
  const plan = await createFountainTransfer(file);
  const first = parseFountainFrame(await plan.getDroplet(0));
  assert(first, 'Fountain fixture did not produce a valid droplet.');
  const decoder = createFountainDecoder(first);
  let duplicates = 0;
  for (let i = 0; i < plan.blocks * 6 && !decoder.reconstruct; i += 1) {
    const raw = await plan.getDroplet(i % 4);
    const frame = parseFountainFrame(raw);
    assert(frame, 'Fountain droplet failed to parse.');
    const result = decoder.add(frame);
    if (result.duplicate) duplicates += 1;
    if (result.complete) break;
  }
  const rebuilt = await decoder.reconstruct();
  assert(rebuilt, 'Fountain decoder could not reconstruct the fixture.');
  expectEqualBytes(rebuilt.bytes, original, 'Fountain round-trip');
  assert(rebuilt.hash === plan.hash, 'Fountain SHA-256 mismatch.');
  return plan.blocks + ' source blocks · randomized droplets · duplicate tolerance · exact SHA-256';
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

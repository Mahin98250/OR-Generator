import { useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, Copy, Search, ScanBarcode, ScanLine, XCircle } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassButton } from '../../components/ui/GlassButton';

type Detected = { type: string; valid: boolean | null; clean: string; message: string };

function checkDigit(code: string) {
  const body = code.slice(0, -1).split('').reverse().map(Number);
  const sum = body.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

function isbn10Valid(code: string) {
  const chars = code.toUpperCase().replace(/[-\s]/g, '');
  if (!/^\d{9}[\dX]$/.test(chars)) return false;
  const sum = chars.split('').reduce((total, char, index) => total + (char === 'X' ? 10 : Number(char)) * (10 - index), 0);
  return sum % 11 === 0;
}

function detect(input: string): Detected {
  const clean = input.toUpperCase().replace(/[-\s]/g, '');
  if (!clean) return { type: 'Waiting for input', valid: null, clean, message: 'Paste a barcode, ISBN or product code to inspect it locally.' };
  if (/^97[89]\d{10}$/.test(clean)) return { type: clean.startsWith('978') || clean.startsWith('979') ? 'ISBN-13 / EAN-13' : 'EAN-13', valid: checkDigit(clean) === Number(clean.at(-1)), clean, message: checkDigit(clean) === Number(clean.at(-1)) ? 'Check digit matches.' : 'Check digit does not match.' };
  if (/^\d{12}$/.test(clean)) return { type: 'UPC-A', valid: checkDigit(clean) === Number(clean.at(-1)), clean, message: checkDigit(clean) === Number(clean.at(-1)) ? 'Check digit matches.' : 'Check digit does not match.' };
  if (/^\d{8}$/.test(clean)) return { type: 'EAN-8', valid: checkDigit(clean) === Number(clean.at(-1)), clean, message: checkDigit(clean) === Number(clean.at(-1)) ? 'Check digit matches.' : 'Check digit does not match.' };
  if (/^\d{9}[\dX]$/.test(clean)) return { type: 'ISBN-10', valid: isbn10Valid(clean), clean, message: isbn10Valid(clean) ? 'ISBN-10 checksum matches.' : 'ISBN-10 checksum does not match.' };
  if (/^\d{13}$/.test(clean)) return { type: '13-digit code', valid: null, clean, message: 'Numeric code detected; no single standard is assumed.' };
  if (/^[A-Z0-9._\-]{4,80}$/.test(clean)) return { type: 'Alphanumeric code', valid: null, clean, message: 'Code detected; format is not assumed.' };
  return { type: 'Text / unknown', valid: null, clean, message: 'This does not look like a common product-code format.' };
}

export function Tools() {
  const [value, setValue] = useState('');
  const result = useMemo(() => detect(value), [value]);

  function copy() { if (navigator.clipboard && result.clean) void navigator.clipboard.writeText(result.clean); }
  function openSearch(engine: 'google' | 'shopping') {
    if (!result.clean) return;
    const base = engine === 'shopping' ? 'https://www.google.com/search?tbm=shop&q=' : 'https://www.google.com/search?q=';
    window.open(base + encodeURIComponent(result.clean), '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="mx-auto max-w-5xl py-8 sm:py-10">
      <div className="mb-7">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em)] text-[var(--text-muted)]"><ScanBarcode size={12} className="text-cyan-300" /> Barcode utilities</div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-5xl">Barcode Lab</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">Inspect common retail/product codes locally, verify supported check digits and jump to a search when you need product context.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <GlassCard>
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)]"><ScanBarcode size={18} className="text-cyan-300" /> Code inspector</div>
          <textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="Paste a barcode number, ISBN or product code…" className="mt-4 min-h-36 w-full resize-none rounded-[22px] border border-[var(--border)] bg-[var(--bg-soft)] p-4 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" />
          <div className="mt-3 flex flex-wrap gap-2">
            <GlassButton onClick={copy} disabled={!result.clean}><Copy size={14} /> Copy cleaned</GlassButton>
            <GlassButton onClick={() => openSearch('google')} disabled={!result.clean}><Search size={14} /> Search web</GlassButton>
            <GlassButton onClick={() => openSearch('shopping')} disabled={!result.clean}><Search size={14} /> Shopping search</GlassButton>
            <GlassButton onClick={() => window.location.hash = '#/scanner'}><ScanLine size={14} /> Scan code</GlassButton>
          </div>
        </GlassCard>

        <GlassCard>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--text-muted)]">Analysis</p>
          <div className="mt-3 flex items-center gap-3">
            {result.valid === true ? <CheckCircle2 className="text-emerald-300" /> : result.valid === false ? <XCircle className="text-rose-300" /> : <ScanBarcode className="text-cyan-300" />}
            <div><p className="font-bold text-[var(--text)]">{result.type}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{result.message}</p></div>
          </div>
          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Normalized value</p>
            <p className="mt-2 break-all text-sm font-mono text-[var(--text)]">{result.clean || '—'}</p>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-4">
            <p className="text-xs font-bold text-[var(--text)]">What this tool does</p>
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">It validates patterns and checksums where a standard is clear. It does not claim to identify a product from its number without a database lookup.</p>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="mt-5">
        <div className="flex items-start gap-3"><Clipboard size={18} className="mt-0.5 text-cyan-300" /><div><p className="font-bold text-[var(--text)]">Daily workflow</p><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Scan a label → inspect the number → tag it in your Scan Library → search the code when you need product context → keep the result locally for later.</p></div></div>
      </GlassCard>
    </section>
  );
}

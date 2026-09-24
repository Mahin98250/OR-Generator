import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, ExternalLink, Heart, Import, Search, ScanBarcode, Trash2, Upload } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassButton } from '../../components/ui/GlassButton';
import { clearHistory, deleteHistoryItem, exportHistory, getHistory, importHistory, toggleFavorite, type HistoryItem } from '../../lib/storage';
import { analyzeScan } from '../../lib/scan';

type Filter = 'all' | 'favorites' | 'qr' | 'barcode';

export function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setItems(getHistory()), []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'favorites' && item.favorite) ||
        (filter === 'qr' && (item.format || '').toLowerCase().includes('qr')) ||
        (filter === 'barcode' && item.kind === 'barcode');
      const matchesQuery = !normalized ||
        item.value.toLowerCase().includes(normalized) ||
        (item.title || '').toLowerCase().includes(normalized) ||
        (item.format || '').toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [items, query, filter]);

  const stats = useMemo(() => ({
    total: items.length,
    favorites: items.filter((item) => item.favorite).length,
    qr: items.filter((item) => (item.format || '').toLowerCase().includes('qr')).length,
    barcodes: items.filter((item) => item.kind === 'barcode').length,
  }), [items]);

  async function copy(value: string) {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      setNotice('Copied to clipboard.');
      window.setTimeout(() => setNotice(''), 1800);
    }
  }

  function downloadBackup() {
    const blob = new Blob([exportHistory()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `or-generator-library-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('Library backup exported.');
  }

  async function handleImport(file: File) {
    try {
      const raw = await file.text();
      const result = importHistory(raw);
      setItems(getHistory());
      setNotice(`Imported ${result.imported} new item${result.imported === 1 ? '' : 's'}.`);
    } catch {
      setNotice('That backup could not be imported.');
    }
  }

  return (
    <section className="mx-auto max-w-5xl py-8 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-5xl">Scan Library</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--text-muted)] sm:text-base">Your local QR and barcode history, searchable and portable.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GlassButton type="button" onClick={downloadBackup}><Download size={14} /> Backup</GlassButton>
          <GlassButton type="button" onClick={() => inputRef.current?.click()}><Upload size={14} /> Restore</GlassButton>
          <input ref={inputRef} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImport(file);
            event.currentTarget.value = '';
          }} />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Scans', stats.total],
          ['QR', stats.qr],
          ['Barcodes', stats.barcodes],
          ['Favorites', stats.favorites],
        ].map(([label, value]) => (
          <div key={String(label)} className="glass-soft rounded-[22px] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--text-muted)]">{String(label)}</p>
            <p className="mt-2 text-2xl font-black text-[var(--text)]">{String(value)}</p>
          </div>
        ))}
      </div>

      <GlassCard>
        <div className="flex flex-col gap-3">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search URLs, contacts, products, UPI, text…" className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-soft)] py-3 pl-11 pr-4 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['all', 'All'],
              ['favorites', 'Favorites'],
              ['qr', 'QR'],
              ['barcode', 'Barcodes'],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={"rounded-full px-3 py-2 text-xs font-bold transition " + (filter === value ? 'bg-[var(--text)] text-[var(--bg)]' : 'border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-muted)]')}>
                {label}
              </button>
            ))}
            <span className="ml-auto text-xs text-[var(--text-muted)]">{filtered.length} shown</span>
          </div>
        </div>

        {notice && <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-xs font-semibold text-cyan-100">{notice}</div>}

        <div className="mt-5 space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[var(--border)] bg-[var(--bg-soft)] px-5 py-12 text-center text-sm text-[var(--text-muted)]">
              No matching scans yet.
            </div>
          ) : filtered.map((item) => {
            const analysis = analyzeScan(item.value, item.format || '');
            return (
              <div key={item.id} className="rounded-[22px] border border-[var(--border)] bg-[var(--bg-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">
                        <ScanBarcode size={12} /> {item.title || analysis.title}
                      </span>
                      {item.format && <span className="text-[10px] font-semibold text-[var(--text-muted)]">{item.format}</span>}
                    </div>
                    <p className="mt-3 break-words text-sm text-[var(--text)]">{item.value}</p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  {item.favorite && <Heart size={15} className="mt-1 shrink-0 fill-current text-pink-400" />}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <GlassButton type="button" onClick={() => void copy(item.value)}><Copy size={14} /> Copy</GlassButton>
                  {analysis.actionUrl && <a href={analysis.actionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold text-[var(--text)]"><ExternalLink size={14} /> Open</a>}
                  <GlassButton type="button" onClick={() => setItems(toggleFavorite(item.id))} aria-label="Toggle favorite"><Heart size={14} className={item.favorite ? 'fill-current' : ''} /></GlassButton>
                  <GlassButton type="button" onClick={() => setItems(deleteHistoryItem(item.id))} aria-label="Delete history item"><Trash2 size={14} /></GlassButton>
                </div>
              </div>
            );
          })}
        </div>

        {items.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
            <p className="text-xs text-[var(--text-muted)]">Backups are plain JSON and contain only this browser's library.</p>
            <GlassButton type="button" onClick={() => { clearHistory(); setItems([]); setNotice('Library cleared from this device.'); }}><Trash2 size={14} /> Clear all</GlassButton>
          </div>
        )}
      </GlassCard>

      <div className="mt-5 flex items-center gap-2 rounded-[22px] border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-3 text-xs text-[var(--text-muted)]">
        <Import size={15} className="shrink-0 text-cyan-300" />
        Tip: use Backup before changing devices, then Restore on the new device. Your library stays local unless you explicitly export it.
      </div>
    </section>
  );
}

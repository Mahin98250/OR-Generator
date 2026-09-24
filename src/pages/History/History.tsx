import { useEffect, useMemo, useState } from 'react';
import { Copy, Heart, Search, Trash2, ScanBarcode, ExternalLink } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassButton } from '../../components/ui/GlassButton';
import { clearHistory, deleteHistoryItem, getHistory, toggleFavorite, type HistoryItem } from '../../lib/storage';
import { analyzeScan } from '../../lib/scan';

export function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setItems(getHistory());
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => item.value.toLowerCase().includes(normalized));
  }, [items, query]);

  async function copy(value: string) {
    if (navigator.clipboard) await navigator.clipboard.writeText(value);
  }

  const stats = useMemo(() => ({
    total: items.length,
    favorites: items.filter((item) => item.favorite).length,
    qr: items.filter((item) => (item.format || '').toLowerCase().includes('qr')).length,
    barcodes: items.filter((item) => item.kind === 'barcode').length,
  }), [items]);

  return (
    <section className="mx-auto max-w-5xl py-8 sm:py-10">
      <div className="mb-6 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-5xl">Scan Library</h1>
        <p className="text-sm leading-7 text-[var(--text-muted)] sm:text-base">Your local QR and barcode history, organized for daily use.</p>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Scans', stats.total],
          ['QR', stats.qr],
          ['Barcodes', stats.barcodes],
          ['Favorites', stats.favorites],
        ].map(([label, value]) => (
          <div key={label} className="glass-soft rounded-[22px] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--text-muted)]">{label}</p>
            <p className="mt-2 text-2xl font-black text-[var(--text)]">{value}</p>
          </div>
        ))}
      </div>

      <GlassCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search history"
              className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"
            />
          </label>
          <GlassButton type="button" onClick={() => { clearHistory(); setItems([]); }}>
            <Trash2 size={14} /> Clear all
          </GlassButton>
        </div>

        <div className="mt-5 space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-white/10 bg-white/5 px-5 py-12 text-center text-sm text-white/50">
              No saved items yet.
            </div>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-[var(--border)] bg-[var(--bg-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">
                        <ScanBarcode size={12} /> {item.title || analyzeScan(item.value, item.format || '').title}
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
                  {analyzeScan(item.value, item.format || '').actionUrl && (
                    <a href={analyzeScan(item.value, item.format || '').actionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold text-[var(--text)]">
                      <ExternalLink size={14} /> Open
                    </a>
                  )}
                  <GlassButton type="button" onClick={() => setItems(toggleFavorite(item.id))} aria-label="Toggle favorite">
                    <Heart size={14} className={item.favorite ? 'fill-current' : ''} />
                  </GlassButton>
                  <GlassButton type="button" onClick={() => setItems(deleteHistoryItem(item.id))} aria-label="Delete history item">
                    <Trash2 size={14} />
                  </GlassButton>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </section>
  );
}

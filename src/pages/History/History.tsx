import { useEffect, useMemo, useState } from 'react';
import { Copy, Heart, Search, Trash2 } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassButton } from '../../components/ui/GlassButton';
import { clearHistory, deleteHistoryItem, getHistory, toggleFavorite, type HistoryItem } from '../../lib/storage';

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

  return (
    <section className="mx-auto max-w-5xl py-8 sm:py-10">
      <div className="mb-6 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">History</h1>
        <p className="text-sm leading-7 text-white/65 sm:text-base">Saved QR payloads and favorites stay on this device.</p>
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
              <div key={item.id} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="break-words text-sm text-white/85">{item.value}</p>
                <p className="mt-2 text-xs text-white/40">{new Date(item.createdAt).toLocaleString()}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <GlassButton type="button" onClick={() => void copy(item.value)}><Copy size={14} /> Copy</GlassButton>
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

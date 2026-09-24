export type HistoryItem = {
  id: string;
  value: string;
  createdAt: number;
  favorite: boolean;
  format?: string;
  kind?: string;
  title?: string;
};

const STORAGE_KEY = 'or-generator-history';
const MAX_ITEMS = 500;

function readHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.value === 'string') : [];
  } catch {
    return [];
  }
}

function writeHistory(items: HistoryItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // Ignore storage failures so scanning/generation remains usable.
  }
}

export function getHistory(): HistoryItem[] {
  return readHistory().sort((a, b) => b.createdAt - a.createdAt);
}

export function saveHistoryItem(value: string, metadata: Pick<HistoryItem, 'format' | 'kind' | 'title' | 'tags' | 'note'> = {}): HistoryItem {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Cannot save an empty scan.');

  const items = readHistory();
  const existing = items.find((item) => item.value === trimmed);

  if (existing) {
    existing.createdAt = Date.now();
    Object.assign(existing, metadata);
    writeHistory(items);
    return existing;
  }

  const item: HistoryItem = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    value: trimmed,
    createdAt: Date.now(),
    favorite: false,
    ...metadata,
  };

  writeHistory([item, ...items]);
  return item;
}

export function toggleFavorite(id: string): HistoryItem[] {
  const items = readHistory().map((item) =>
    item.id === id ? { ...item, favorite: !item.favorite } : item
  );
  writeHistory(items);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export function deleteHistoryItem(id: string): HistoryItem[] {
  const items = readHistory().filter((item) => item.id !== id);
  writeHistory(items);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export function updateHistoryItem(id: string, patch: Partial<Pick<HistoryItem, 'favorite' | 'format' | 'kind' | 'title' | 'tags' | 'note'>>): HistoryItem[] {
  const items = readHistory().map((item) => item.id === id ? { ...item, ...patch } : item);
  writeHistory(items);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export function clearHistory() {
  writeHistory([]);
}

export function exportHistory(): string {
  return JSON.stringify({
    app: 'OR-Generator',
    version: 2,
    exportedAt: new Date().toISOString(),
    items: getHistory(),
  }, null, 2);
}

export function importHistory(raw: string): { imported: number; skipped: number } {
  const parsed = JSON.parse(raw) as { items?: unknown };
  const incoming = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(incoming)) throw new Error('This file does not contain an OR-Generator library.');

  const existing = readHistory();
  const byValue = new Map(existing.map((item) => [item.value, item]));
  let imported = 0;
  let skipped = 0;

  for (const candidate of incoming) {
    if (!candidate || typeof candidate !== 'object') {
      skipped += 1;
      continue;
    }
    const item = candidate as Partial<HistoryItem>;
    if (typeof item.value !== 'string' || !item.value.trim()) {
      skipped += 1;
      continue;
    }

    const value = item.value.trim();
    const current = byValue.get(value);
    if (current) {
      current.createdAt = Math.max(current.createdAt || 0, Number(item.createdAt) || 0);
      current.favorite = Boolean(current.favorite || item.favorite);
      current.format ||= item.format;
      current.kind ||= item.kind;
      current.title ||= item.title;
    } else {
      const next: HistoryItem = {
        id: typeof item.id === 'string' ? item.id : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        value,
        createdAt: Number(item.createdAt) || Date.now(),
        favorite: Boolean(item.favorite),
        format: item.format,
        kind: item.kind,
        title: item.title,
      };
      byValue.set(value, next);
      imported += 1;
    }
  }

  writeHistory([...byValue.values()].sort((a, b) => b.createdAt - a.createdAt));
  return { imported, skipped };
}

export function getStorageUsageBytes(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return new Blob([window.localStorage.getItem(STORAGE_KEY) || '']).size;
  } catch {
    return 0;
  }
}

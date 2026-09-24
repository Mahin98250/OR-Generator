export type HistoryItem = {
  id: string;
  value: string;
  createdAt: number;
  favorite: boolean;
};

const STORAGE_KEY = 'or-generator-history';

function readHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(items: HistoryItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage failures so core QR generation remains usable.
  }
}

export function getHistory(): HistoryItem[] {
  return readHistory().sort((a, b) => b.createdAt - a.createdAt);
}

export function saveHistoryItem(value: string): HistoryItem {
  const trimmed = value.trim();
  const items = readHistory();
  const existing = items.find((item) => item.value === trimmed);

  if (existing) {
    existing.createdAt = Date.now();
    writeHistory(items);
    return existing;
  }

  const item: HistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    value: trimmed,
    createdAt: Date.now(),
    favorite: false,
  };

  writeHistory([item, ...items].slice(0, 100));
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
  return items;
}

export function clearHistory() {
  writeHistory([]);
}

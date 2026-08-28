const KEY = "findit:pending-find";

export type PendingFind = {
  id: string;
  productName: string;
  city: string;
  state: string;
  postalCode: string;
  imageUrl: string | null;
  createdAt: string;
  expiresAt: string;
  storesTargeted: number;
  startedAt: number;
};

export type PendingFindStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function defaultStorage(): PendingFindStorage | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage;
}

export function writePendingFind(
  find: PendingFind,
  storage: PendingFindStorage | null = defaultStorage()
) {
  if (!storage) return;
  storage.setItem(KEY, JSON.stringify(find));
}

export function readPendingFind(
  id: string,
  storage: PendingFindStorage | null = defaultStorage()
): PendingFind | null {
  if (!storage || !id) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingFind;
    if (parsed.id !== id) return null;
    if (Date.now() - parsed.startedAt > 120_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingFind(
  id?: string,
  storage: PendingFindStorage | null = defaultStorage()
) {
  if (!storage) return;
  if (!id) {
    storage.removeItem(KEY);
    return;
  }
  const current = readPendingFind(id, storage);
  if (current) storage.removeItem(KEY);
}

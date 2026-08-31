const PREFIX = "findit-cache-v1:";
const DEFAULT_TTL_MS = 45_000;

type Envelope<T> = { at: number; value: T };

function canUseStorage() {
  return typeof window !== "undefined";
}

export function readCached<T>(key: string, maxAgeMs = DEFAULT_TTL_MS): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeCached<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // Private mode / quota — skip.
  }
}

export function clearCached(key: string) {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    // Ignore.
  }
}

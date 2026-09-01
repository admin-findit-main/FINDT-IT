/** Hub should only chime for a Find that just arrived — not on refresh, cache, or remount. */

export const HUB_ALERT_MAX_AGE_MS = 2 * 60 * 1000;

export type HubAlertRow = {
  id: string;
  created_at: string;
};

export function hubRequestsToAlert(input: {
  primed: boolean;
  seenIds: Iterable<string>;
  pending: HubAlertRow[];
  now?: number;
  maxAgeMs?: number;
}): string[] {
  if (!input.primed) return [];
  const seen = input.seenIds instanceof Set ? input.seenIds : new Set(input.seenIds);
  const now = input.now ?? Date.now();
  const maxAge = input.maxAgeMs ?? HUB_ALERT_MAX_AGE_MS;
  const ids: string[] = [];
  for (const row of input.pending) {
    if (seen.has(row.id)) continue;
    const created = new Date(row.created_at).getTime();
    if (!Number.isFinite(created)) continue;
    if (now - created > maxAge) continue;
    ids.push(row.id);
  }
  return ids;
}

export function hubSeenStorageKey(storeId: string): string {
  return `findit-hub-seen:${storeId}`;
}

export function readHubSeenIds(
  storeId: string,
  storage: { getItem(key: string): string | null } | null
): Set<string> {
  if (!storage || !storeId) return new Set();
  try {
    const raw = storage.getItem(hubSeenStorageKey(storeId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function writeHubSeenIds(
  storeId: string,
  ids: Iterable<string>,
  storage: { setItem(key: string, value: string): void } | null
) {
  if (!storage || !storeId) return;
  try {
    storage.setItem(hubSeenStorageKey(storeId), JSON.stringify([...ids]));
  } catch {
    // Private mode / quota.
  }
}

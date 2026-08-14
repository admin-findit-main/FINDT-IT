/**
 * Store hours helpers — open/closed detection without spam notifications.
 */

export interface StoreHourRow {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

function parseTimeToMinutes(value: string | null): number | null {
  if (!value) return null;
  const parts = value.slice(0, 5).split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function isStoreOpenAt(
  hours: StoreHourRow[],
  at: Date = new Date(),
  timeZoneOffsetMinutes?: number
): { open: boolean; label: string; reopenAt: Date | null } {
  const local = timeZoneOffsetMinutes == null
    ? at
    : new Date(at.getTime() + timeZoneOffsetMinutes * 60_000);
  const day = local.getDay();
  const mins = local.getHours() * 60 + local.getMinutes();
  const row = hours.find((h) => h.day_of_week === day);

  if (!row || row.is_closed) {
    const reopen = nextOpenTime(hours, local);
    return {
      open: false,
      label: "Closed",
      reopenAt: reopen,
    };
  }

  const openM = parseTimeToMinutes(row.open_time);
  const closeM = parseTimeToMinutes(row.close_time);
  if (openM == null || closeM == null) {
    return { open: false, label: "Hours unavailable", reopenAt: null };
  }

  // Overnight close (e.g. 22:00–02:00)
  const open =
    closeM < openM ? mins >= openM || mins < closeM : mins >= openM && mins < closeM;

  return {
    open,
    label: open ? "Open now" : "Closed",
    reopenAt: open ? null : nextOpenTime(hours, local),
  };
}

export function nextOpenTime(hours: StoreHourRow[], from: Date = new Date()): Date | null {
  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(from);
    d.setDate(d.getDate() + offset);
    const day = d.getDay();
    const row = hours.find((h) => h.day_of_week === day);
    if (!row || row.is_closed) continue;
    const openM = parseTimeToMinutes(row.open_time);
    if (openM == null) continue;
    const candidate = new Date(d);
    candidate.setHours(Math.floor(openM / 60), openM % 60, 0, 0);
    if (candidate.getTime() > from.getTime()) return candidate;
  }
  return null;
}

export function formatHoursSummary(hours: StoreHourRow[]): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return hours
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((h) => {
      if (h.is_closed || !h.open_time || !h.close_time) {
        return `${days[h.day_of_week]}: Closed`;
      }
      return `${days[h.day_of_week]}: ${h.open_time.slice(0, 5)}–${h.close_time.slice(0, 5)}`;
    })
    .join(" · ");
}

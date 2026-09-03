/** Minutes of a punch that fall inside [windowStart, windowEnd). */
export function minutesInWindow(input: {
  clocked_in_at: string;
  clocked_out_at: string | null;
  windowStart: number;
  windowEnd: number;
  now?: number;
}): number {
  const now = input.now ?? Date.now();
  const start = new Date(input.clocked_in_at).getTime();
  const end = input.clocked_out_at ? new Date(input.clocked_out_at).getTime() : now;
  const from = Math.max(start, input.windowStart);
  const to = Math.min(end, input.windowEnd, now);
  return Math.max(0, Math.floor((to - from) / 60_000));
}

export function startOfLocalDay(at = new Date()): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate());
}

/** Local week starting Monday. */
export function startOfLocalWeek(at = new Date()): Date {
  const day = startOfLocalDay(at);
  const mondayOffset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - mondayOffset);
  return day;
}

export function formatShiftHours(minutes: number): string {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

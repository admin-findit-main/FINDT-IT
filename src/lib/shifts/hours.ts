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

export function localDateValue(at = new Date()): string {
  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const day = String(at.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

function parseTime(value: string | undefined): { hours: number; minutes: number } | null {
  if (!value) return { hours: 0, minutes: 0 };
  const match = TIME_RE.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/** Local window for a calendar day, optionally clipped to a start/end time. */
export function windowFromLocalParts(input: {
  date: string;
  startTime?: string;
  endTime?: string;
}): { start: number; end: number } | null {
  const dateMatch = DATE_RE.exec(input.date);
  if (!dateMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;

  const startTime = parseTime(input.startTime || undefined);
  const endTime = input.endTime ? parseTime(input.endTime) : { hours: 0, minutes: 0 };
  if (!startTime || !endTime) return null;

  const start = new Date(
    year,
    month,
    day,
    startTime.hours,
    startTime.minutes
  ).getTime();
  let end: number;
  if (!input.endTime) {
    end = new Date(year, month, day + 1).getTime();
  } else {
    end = new Date(year, month, day, endTime.hours, endTime.minutes).getTime();
    if (end <= start) {
      end = new Date(year, month, day + 1, endTime.hours, endTime.minutes).getTime();
    }
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end };
}

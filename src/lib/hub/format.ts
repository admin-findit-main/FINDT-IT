export function normalizePairingCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}

export function formatPairingCode(code: string): string {
  const digits = code.replace(/\D/g, "").padStart(6, "0").slice(0, 6);
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

export function deviceIsOnline(
  lastSeenAt: string | null | undefined,
  now = Date.now(),
  windowMs = 2 * 60 * 1000
): boolean {
  if (!lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() <= windowMs;
}

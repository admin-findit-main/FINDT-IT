/**
 * Web error monitoring stub — pair with mobile lib/monitoring.ts.
 * Set NEXT_PUBLIC_SENTRY_DSN later; never throw from these helpers.
 */

type Context = Record<string, unknown>;

export function captureException(error: unknown, context?: Context) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[findit:error]", error, context || {});
  }
  // Future: Sentry.captureException(error, { extra: context });
}

export function captureMessage(message: string, context?: Context) {
  if (process.env.NODE_ENV !== "production") {
    console.info("[findit:info]", message, context || {});
  }
}

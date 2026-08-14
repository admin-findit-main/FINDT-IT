/**
 * Lightweight error monitoring hook.
 * Wire SENTRY_DSN / EXPO_PUBLIC_SENTRY_DSN later — logs in dev, no-ops gracefully.
 */

type Context = Record<string, unknown>;

export function captureException(error: unknown, context?: Context) {
  const message = error instanceof Error ? error.message : String(error);
  if (__DEV__) {
    console.warn("[findit:error]", message, context || {});
  }
  // Future: Sentry.captureException(error, { extra: context });
}

export function captureMessage(message: string, context?: Context) {
  if (__DEV__) {
    console.log("[findit:info]", message, context || {});
  }
}

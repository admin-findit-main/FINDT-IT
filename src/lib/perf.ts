/** Dev-only timing. Silent in production. Never logs secrets. */
export async function measurePerf<T>(
  operation: string,
  work: () => Promise<T>
): Promise<T> {
  if (process.env.NODE_ENV === "production") return work();
  const started = performance.now();
  try {
    return await work();
  } finally {
    const ms = Math.round(performance.now() - started);
    if (ms >= 80) {
      console.info(`[PERF] ${operation}: ${ms}ms`);
    }
  }
}

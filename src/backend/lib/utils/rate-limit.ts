type WindowEntry = { count: number; resetAt: number };

const globalForRateLimit = globalThis as typeof globalThis & { rateLimitStore?: Map<string, WindowEntry> };
const store = globalForRateLimit.rateLimitStore ?? new Map<string, WindowEntry>();
globalForRateLimit.rateLimitStore = store;

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  store.set(key, entry);
  return {
    allowed: entry.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

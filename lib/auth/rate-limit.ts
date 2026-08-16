import "server-only";

/**
 * In-process sliding-window rate limiter for authentication endpoints. Suitable for the current
 * single-instance deployment; swap the store for Upstash when the platform scales out.
 */
const BUCKET_KEY = Symbol.for("careersrx.auth.rateLimit");

type Bucket = Map<string, number[]>;

function bucket(): Bucket {
  const holder = globalThis as typeof globalThis & { [BUCKET_KEY]?: Bucket };
  if (!holder[BUCKET_KEY]) holder[BUCKET_KEY] = new Map();
  return holder[BUCKET_KEY];
}

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean } {
  const store = bucket();
  const cutoff = Date.now() - windowMs;
  const hits = (store.get(key) ?? []).filter((at) => at > cutoff);
  if (hits.length >= limit) {
    store.set(key, hits);
    return { allowed: false };
  }
  hits.push(Date.now());
  store.set(key, hits);
  if (store.size > 10_000) {
    // Bounded memory: discard the oldest keys when the table grows unreasonably.
    for (const candidate of store.keys()) {
      if (store.size <= 5_000) break;
      store.delete(candidate);
    }
  }
  return { allowed: true };
}

export function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0]!.trim() : "local";
}

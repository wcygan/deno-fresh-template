const buckets = new Map<string, { tokens: number; updated: number }>();
const CAP = 60; // tokens
const REFILL_MS = 60_000; // per minute

export function allow(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: CAP, updated: now };
  const refill = Math.floor((now - b.updated) / REFILL_MS) * CAP;
  b.tokens = Math.min(CAP, b.tokens + Math.max(0, refill));
  b.updated = now;
  if (b.tokens <= 0) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}

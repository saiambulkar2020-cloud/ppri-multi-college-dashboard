import { createHash } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
type Bucket = { count: number; until: number };
type LoginLimits = { total: Bucket; accounts: Map<string, Bucket> };
const globals = globalThis as typeof globalThis & { ppriLoginLimits?: LoginLimits };
const limits = globals.ppriLoginLimits ??= { total: { count: 0, until: 0 }, accounts: new Map() };
const accountKey = (id: string) => createHash("sha256").update(id.trim().toLowerCase()).digest("hex");

export function reserveLoginAttempt(id: string, now = Date.now()) {
  if (now >= limits.total.until) {
    limits.total = { count: 0, until: now + WINDOW_MS };
    limits.accounts.clear();
  }
  const key = accountKey(id);
  let bucket = limits.accounts.get(key);
  if (!bucket || now >= bucket.until) bucket = { count: 0, until: now + WINDOW_MS };
  if (limits.total.count >= 60 || bucket.count >= 5) {
    return Math.max(1, Math.ceil(((limits.total.count >= 60 ? limits.total : bucket).until - now) / 1000));
  }
  // Reserve synchronously, before awaiting password verification. The total cap also bounds memory.
  limits.total.count += 1;
  bucket.count += 1;
  limits.accounts.set(key, bucket);
  return 0;
}

export function clearSuccessfulLoginAttempts(id: string) {
  limits.accounts.delete(accountKey(id));
}

import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);
export const ACCESS_SESSION_SECONDS = 30 * 60;

function equalText(left: string, right: string) {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

export async function hashAccessPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt, 64) as Buffer;
  return `scrypt-v1$${salt}$${key.toString("hex")}`;
}

export async function verifyAccessPassword(password: string, encoded: string) {
  if (!isAccessPasswordHash(encoded) || password.length > 1024) return false;
  const [, salt, expected] = encoded.split("$");
  const actual = await deriveKey(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

export function isAccessPasswordHash(value: string) {
  return /^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value);
}

export function accessIdentityMatches(actual: string, expected: string) {
  return equalText(actual.trim().toLowerCase(), expected.trim().toLowerCase());
}

export function localAccessSubject(id: string, passwordHash: string) {
  // Rotating either the local ID or password invalidates existing local sessions.
  return `local:${createHash("sha256").update(`${id.trim().toLowerCase()}\0${passwordHash}`).digest("hex")}`;
}

export function signAccessSession(subject: string, secret: string, now = Date.now()) {
  if (secret.length < 32 || !subject) throw new Error("ACCESS_NOT_CONFIGURED");
  const issued = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, sub: subject, iat: issued, exp: issued + ACCESS_SESSION_SECONDS })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAccessSession(token: string | undefined, subject: string, secret: string, now = Date.now()) {
  if (!token || token.length > 2048 || !subject || secret.length < 32) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return false;
  const signature = createHmac("sha256", secret).update(parts[0]).digest("base64url");
  if (!equalText(signature, parts[1])) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const seconds = Math.floor(now / 1000);
    return payload.v === 1 && payload.sub === subject && Number.isSafeInteger(payload.iat) && Number.isSafeInteger(payload.exp)
      && payload.iat <= seconds && payload.exp > seconds && payload.exp - payload.iat === ACCESS_SESSION_SECONDS;
  } catch {
    return false;
  }
}

// Explicit internal destinations only: never accept an arbitrary post-login URL.
export function safeLoginDestination(value: unknown) {
  if (typeof value !== "string") return "/dashboard";
  const college = value.match(/^\/dashboard\/colleges\/(demo|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(.*)$/i);
  if (college) {
    const suffix = college[2];
    if (["", "?report=1", "/admin", "/students", "/comparison", "/competencies", "/data-quality"].includes(suffix)) return value;
    if (suffix.startsWith("/students/") && safeLoginDestination(`/dashboard${suffix}`) !== "/dashboard") return value;
    return "/dashboard";
  }
  if (["/dashboard", "/dashboard/admin", "/dashboard?report=1", "/dashboard/students"].includes(value)) return value;
  if (/^\/dashboard\/students\/[A-Za-z0-9_%.-]+$/.test(value)) {
    try {
      const uid = decodeURIComponent(value.slice("/dashboard/students/".length));
      if (uid && uid !== "." && uid !== ".." && !/[\\/\u0000-\u001f]/.test(uid)) return value;
    } catch { /* Invalid percent encoding is not a return destination. */ }
  }
  return "/dashboard";
}

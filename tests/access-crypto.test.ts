import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { ACCESS_SESSION_SECONDS, accessIdentityMatches, hashAccessPassword, isAccessPasswordHash, localAccessSubject, safeLoginDestination, signAccessSession, verifyAccessPassword, verifyAccessSession } from "../lib/access-crypto";
import { accessErrorResponse, assertSameOrigin } from "../lib/access-http";
import { clearSuccessfulLoginAttempts, reserveLoginAttempt } from "../lib/access-throttle";

const secret = "test-only-secret-with-at-least-thirty-two-characters";
const now = Date.UTC(2026, 8, 9, 12);
const subject = "supabase:test-administrator";

function signedPayload(payload: unknown) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
}

describe("Password and identity verification", () => {
  it("uses randomized salts, accepts the correct password and rejects a different password", async () => {
    const password = "Only for unit tests! 2026";
    const first = await hashAccessPassword(password);
    const second = await hashAccessPassword(password);
    expect(first).not.toBe(second);
    expect(isAccessPasswordHash(first)).toBe(true);
    expect(first).not.toContain(password);
    expect(await verifyAccessPassword(password, first)).toBe(true);
    expect(await verifyAccessPassword(`${password}!`, first)).toBe(false);
    expect(await verifyAccessPassword("x".repeat(1025), first)).toBe(false);
  });

  it.each(["", "plain-password", "scrypt-v1$abc$def", `scrypt-v1$${"a".repeat(32)}$${"g".repeat(128)}`, `scrypt-v2$${"a".repeat(32)}$${"b".repeat(128)}`])("fails closed for malformed password hash %j", async (hash) => {
    expect(isAccessPasswordHash(hash)).toBe(false);
    expect(await verifyAccessPassword("password", hash)).toBe(false);
  });

  it("normalizes only the account ID and invalidates subjects after ID or password rotation", () => {
    expect(accessIdentityMatches(" Admin@College.edu ", "admin@college.edu")).toBe(true);
    expect(accessIdentityMatches("admin", "administrator")).toBe(false);
    expect(localAccessSubject(" ADMIN ", "hash1")).toBe(localAccessSubject("admin", "hash1"));
    expect(localAccessSubject("admin", "hash1")).not.toBe(localAccessSubject("admin", "hash2"));
    expect(localAccessSubject("admin", "hash1")).not.toBe(localAccessSubject("other", "hash1"));
  });
});

describe("Administrator access sessions", () => {
  it("accepts a valid token only during its fixed thirty-minute lifetime", () => {
    const token = signAccessSession(subject, secret, now);
    expect(verifyAccessSession(token, subject, secret, now)).toBe(true);
    expect(verifyAccessSession(token, subject, secret, now + ACCESS_SESSION_SECONDS * 1000 - 1)).toBe(true);
    expect(verifyAccessSession(token, subject, secret, now + ACCESS_SESSION_SECONDS * 1000)).toBe(false);
    expect(verifyAccessSession(token, subject, secret, now - 1000)).toBe(false);
  });

  it("rejects another account, a rotated secret, and altered payload or signature", () => {
    const token = signAccessSession(subject, secret, now);
    const [payload, signature] = token.split(".");
    const altered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), sub: "supabase:attacker" })).toString("base64url");
    expect(verifyAccessSession(token, "supabase:another-user", secret, now)).toBe(false);
    expect(verifyAccessSession(token, subject, `${secret}-rotated`, now)).toBe(false);
    expect(verifyAccessSession(`${altered}.${signature}`, "supabase:attacker", secret, now)).toBe(false);
    expect(verifyAccessSession(`${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`, subject, secret, now)).toBe(false);
  });

  it.each([undefined, "", ".", "a.b.c", "a.invalid-signature", "x".repeat(2049), `***.${"a".repeat(43)}`])("rejects malformed token %j without throwing", (token) => {
    expect(verifyAccessSession(token, subject, secret, now)).toBe(false);
  });

  it("rejects correctly signed but invalid session payloads", () => {
    const seconds = now / 1000;
    const valid = { v: 1, sub: subject, iat: seconds, exp: seconds + ACCESS_SESSION_SECONDS };
    for (const invalid of [null, [], {}, { ...valid, v: 2 }, { ...valid, iat: seconds + 1 }, { ...valid, exp: valid.exp + 1 }, { ...valid, iat: String(seconds) }, { ...valid, exp: Infinity }, { ...valid, sub: "other" }]) {
      expect(verifyAccessSession(signedPayload(invalid), subject, secret, now)).toBe(false);
    }
  });

  it("fails closed when signing or verifying without a configured subject and secret", () => {
    expect(() => signAccessSession(subject, "short", now)).toThrow("ACCESS_NOT_CONFIGURED");
    expect(() => signAccessSession("", secret, now)).toThrow("ACCESS_NOT_CONFIGURED");
    const token = signAccessSession(subject, secret, now);
    expect(verifyAccessSession(token, subject, "short", now)).toBe(false);
    expect(verifyAccessSession(token, "", secret, now)).toBe(false);
  });
});

describe("Post-login destinations", () => {
  it.each(["/dashboard", "/dashboard/admin", "/dashboard?report=1", "/dashboard/students", "/dashboard/students/IT-001", "/dashboard/students/IT%20001"])("preserves supported destination %s", (destination) => {
    expect(safeLoginDestination(destination)).toBe(destination);
  });

  it.each([undefined, null, 123, "https://attacker.example", "//attacker.example", "\\\\attacker.example", "/dashboard/admin?next=https://attacker.example", "/dashboard?report=1&next=//attacker.example", "/dashboard/../admin", "/dashboard/students/..", "/dashboard/students/%2e%2e", "/dashboard/students/%2F%2Fattacker.example", "/dashboard/students/%5Cevil", "/dashboard/students/%00", "/dashboard/students/%", "/dashboard/students/id#fragment", "/dashboard/students/id?next=evil"])("falls back safely for unsupported destination %j", (destination) => {
    expect(safeLoginDestination(destination)).toBe("/dashboard");
  });
});

describe("Same-origin protections and safe errors", () => {
  it("accepts an exact same-origin request", () => {
    expect(() => assertSameOrigin(new Request("https://college.example/api/auth/login", { headers: { origin: "https://college.example", "sec-fetch-site": "same-origin" } }))).not.toThrow();
  });

  it.each<Record<string, string>>([{}, { origin: "null" }, { origin: "https://attacker.example" }, { origin: "http://college.example" }, { origin: "https://college.example:444" }, { origin: "https://college.example", "sec-fetch-site": "cross-site" }])("rejects missing, cross-origin, or conflicting request metadata %j", (headers) => {
    expect(() => assertSameOrigin(new Request("https://college.example/api/auth/login", { headers }))).toThrow("INVALID_ORIGIN");
  });

  it.each([["UNAUTHENTICATED", 401], ["FORBIDDEN", 403], ["INVALID_ORIGIN", 403], ["ACCESS_NOT_CONFIGURED", 503], ["database-password-private-detail", 500]] as const)("returns no-store safe response for %s", async (code, status) => {
    const response = accessErrorResponse(new Error(code));
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).error).not.toContain("database-password-private-detail");
  });
});

describe("Bounded login throttling", () => {
  let clock = now;
  beforeEach(() => {
    // Each test starts after the previous global window, without altering implementation internals.
    clock += 31 * 60 * 1000;
  });

  it("allows five attempts per normalized account, reserves synchronously, and returns retry time", async () => {
    const attempts = await Promise.all(Array.from({ length: 8 }, (_, i) => Promise.resolve(reserveLoginAttempt(i % 2 ? " ADMIN " : "admin", clock))));
    expect(attempts.slice(0, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(attempts.slice(5)).toEqual([900, 900, 900]);
    expect(reserveLoginAttempt("admin", clock + 1000)).toBe(899);
  });

  it("caps attempts across distinct identities without depending on client-provided IP addresses", () => {
    for (let index = 0; index < 60; index += 1) expect(reserveLoginAttempt(`account-${index}`, clock)).toBe(0);
    expect(reserveLoginAttempt("another-account", clock)).toBe(900);
    expect(reserveLoginAttempt("one-more-account", clock + 899_999)).toBe(1);
    expect(reserveLoginAttempt("new-window-account", clock + 900_000)).toBe(0);
  });

  it("clears a successful account without clearing the global abuse budget", () => {
    for (let index = 0; index < 5; index += 1) expect(reserveLoginAttempt("admin", clock)).toBe(0);
    clearSuccessfulLoginAttempts(" ADMIN ");
    expect(reserveLoginAttempt("admin", clock)).toBe(0);
    for (let index = 0; index < 54; index += 1) expect(reserveLoginAttempt(`other-${index}`, clock)).toBe(0);
    clearSuccessfulLoginAttempts("admin");
    expect(reserveLoginAttempt("admin", clock)).toBe(900);
  });

  it("releases expired per-account attempts at the window boundary", () => {
    for (let index = 0; index < 5; index += 1) reserveLoginAttempt("admin", clock);
    expect(reserveLoginAttempt("admin", clock + 899_000)).toBe(1);
    expect(reserveLoginAttempt("admin", clock + 900_000)).toBe(0);
  });
});

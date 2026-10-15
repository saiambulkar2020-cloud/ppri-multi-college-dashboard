import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: false,
  user: null as { id: string; email?: string } | null,
  userError: null as { message: string } | null,
  profileRole: "viewer" as string | null,
  collegeId: "10000000-0000-4000-8000-000000000001" as string | null,
  adminEmails: new Set<string>(),
  cookieStore: new Map<string, string>(),
  setCookie: vi.fn(),
  getUser: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) => state.cookieStore.has(key) ? { name: key, value: state.cookieStore.get(key) } : undefined,
    set: (key: string, value: string, options: unknown) => {
      state.cookieStore.set(key, value);
      state.setCookie(key, value, options);
    },
  }),
}));
vi.mock("../lib/supabase/config", () => ({
  isSupabaseConfigured: () => state.configured,
  adminEmails: () => state.adminEmails,
}));
vi.mock("../lib/supabase/server", () => ({ createClient: state.createClient }));

import { requireAdmin, requireUser } from "../lib/auth";
import { accessSessionConfigured, clearAccessSession, hasAccessSession, issueAccessSession, localAccessConfig } from "../lib/access-session";
import { ACCESS_SESSION_SECONDS, signAccessSession } from "../lib/access-crypto";

const secret = "test-only-session-secret-at-least-32-characters";
const hash = `scrypt-v1$${"a".repeat(32)}$${"b".repeat(128)}`;

beforeEach(() => {
  state.configured = false;
  state.user = null;
  state.userError = null;
  state.profileRole = "viewer";
  state.collegeId = "10000000-0000-4000-8000-000000000001";
  state.adminEmails.clear();
  state.cookieStore.clear();
  vi.clearAllMocks();
  vi.stubEnv("ACCESS_ADMIN_ID", "local-admin");
  vi.stubEnv("ACCESS_ADMIN_PASSWORD_HASH", hash);
  vi.stubEnv("ACCESS_SESSION_SECRET", secret);
  state.getUser.mockImplementation(async () => ({ data: { user: state.user }, error: state.userError }));
  state.createClient.mockResolvedValue({
    auth: { getUser: state.getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.profileRole ? { role: state.profileRole, college_id: state.collegeId, username: null } : null, error: null }) }) }) }),
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("Local administrator access", () => {
  it("keeps the public demo unauthenticated and denies its protected administration action", async () => {
    expect(await requireUser()).toBeNull();
    await expect(requireAdmin()).rejects.toThrow("UNAUTHENTICATED");
    expect(state.createClient).not.toHaveBeenCalled();
  });

  it("recognizes a valid local administrator session with a secure short-lived cookie", async () => {
    const config = localAccessConfig();
    expect(config).not.toBeNull();
    await issueAccessSession(config!.subject);
    expect(state.setCookie).toHaveBeenLastCalledWith("ppri_admin_access", expect.any(String), { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: ACCESS_SESSION_SECONDS });
    expect(await requireAdmin()).toEqual({ email: "local-admin", role: "admin", subject: config!.subject, collegeId: null, username: "local-admin" });
    expect(state.createClient).not.toHaveBeenCalled();
  });

  it("revokes the local session on sign-out", async () => {
    const config = localAccessConfig()!;
    await issueAccessSession(config.subject);
    expect(await hasAccessSession(config.subject)).toBe(true);
    await clearAccessSession();
    expect(state.setCookie).toHaveBeenLastCalledWith("ppri_admin_access", "", expect.objectContaining({ httpOnly: true, maxAge: 0, path: "/" }));
    expect(await hasAccessSession(config.subject)).toBe(false);
    await expect(requireAdmin()).rejects.toThrow("UNAUTHENTICATED");
  });

  it("invalidates existing sessions after a password hash or ID rotation", async () => {
    await issueAccessSession(localAccessConfig()!.subject);
    vi.stubEnv("ACCESS_ADMIN_PASSWORD_HASH", `scrypt-v1$${"c".repeat(32)}$${"d".repeat(128)}`);
    await expect(requireAdmin()).rejects.toThrow("UNAUTHENTICATED");
    vi.stubEnv("ACCESS_ADMIN_PASSWORD_HASH", hash);
    vi.stubEnv("ACCESS_ADMIN_ID", "another-admin");
    await expect(requireAdmin()).rejects.toThrow("UNAUTHENTICATED");
  });

  it.each([["ACCESS_ADMIN_ID", ""], ["ACCESS_ADMIN_PASSWORD_HASH", "not-a-hash"], ["ACCESS_SESSION_SECRET", "short"]])("fails closed with incomplete configuration: %s", async (key, value) => {
    vi.stubEnv(key, value);
    expect(localAccessConfig()).toBeNull();
    expect(await requireUser()).toBeNull();
    await expect(requireAdmin()).rejects.toThrow("UNAUTHENTICATED");
  });

  it("requires a sufficiently long session secret", () => {
    expect(accessSessionConfigured()).toBe(true);
    vi.stubEnv("ACCESS_SESSION_SECRET", "x".repeat(31));
    expect(accessSessionConfigured()).toBe(false);
  });
});

describe("Live college administrator authorization", () => {
  beforeEach(() => { state.configured = true; });

  it("never accepts the local fallback when Supabase is configured", async () => {
    state.configured = false;
    const local = localAccessConfig()!;
    await issueAccessSession(local.subject);
    state.configured = true;
    expect(localAccessConfig()).toBeNull();
    await expect(requireAdmin()).rejects.toThrow("UNAUTHENTICATED");
    expect(state.getUser).toHaveBeenCalled();
  });

  it("rejects a failed server-verified user lookup even if an access cookie exists", async () => {
    state.user = { id: "admin-1", email: "admin@college.example" };
    state.profileRole = "admin";
    state.userError = { message: "Token invalid" };
    await issueAccessSession("supabase:admin-1");
    await expect(requireAdmin()).rejects.toThrow("UNAUTHENTICATED");
  });

  it("allows a signed-in viewer to use the dashboard but denies administrator actions", async () => {
    state.user = { id: "viewer-1", email: "Viewer@College.Example" };
    await issueAccessSession("supabase:viewer-1");
    expect(await requireUser()).toEqual({ email: "viewer@college.example", role: "viewer", subject: "supabase:viewer-1", collegeId: state.collegeId, username: null });
    await expect(requireAdmin()).rejects.toThrow("FORBIDDEN");
  });

  it("requires a recent access login as well as the live administrator role", async () => {
    state.user = { id: "admin-1", email: "admin@college.example" };
    state.profileRole = "admin";
    expect((await requireUser())?.role).toBe("admin");
    await expect(requireAdmin()).rejects.toThrow("UNAUTHENTICATED");
    await issueAccessSession("supabase:admin-1");
    expect((await requireAdmin()).role).toBe("admin");
  });

  it("does not reuse an administrator access cookie after switching to another account", async () => {
    state.profileRole = "admin";
    state.user = { id: "admin-1", email: "first@college.example" };
    await issueAccessSession("supabase:admin-1");
    expect((await requireAdmin()).email).toBe("first@college.example");
    state.user = { id: "admin-2", email: "second@college.example" };
    await expect(requireAdmin()).rejects.toThrow("UNAUTHENTICATED");
  });

  it("rechecks current roles and revokes access immediately after administrator demotion", async () => {
    state.user = { id: "admin-1", email: "admin@college.example" };
    state.profileRole = "admin";
    await issueAccessSession("supabase:admin-1");
    expect((await requireAdmin()).role).toBe("admin");
    state.profileRole = "viewer";
    await expect(requireAdmin()).rejects.toThrow("FORBIDDEN");
  });

  it("does not grant administrator access from a legacy email allowlist", async () => {
    state.user = { id: "admin-1", email: "Admin@College.Example" };
    state.adminEmails.add("admin@college.example");
    state.profileRole = null;
    await issueAccessSession("supabase:admin-1");
    await expect(requireAdmin()).rejects.toThrow("FORBIDDEN");
  });

  it("denies expired access cookies even if Supabase still has a live session", async () => {
    state.user = { id: "admin-1", email: "admin@college.example" };
    state.profileRole = "admin";
    state.cookieStore.set("ppri_admin_access", signAccessSession("supabase:admin-1", secret, Date.now() - ACCESS_SESSION_SECONDS * 1000));
    await expect(requireAdmin()).rejects.toThrow("UNAUTHENTICATED");
  });
});

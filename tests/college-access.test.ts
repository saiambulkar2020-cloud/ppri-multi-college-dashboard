import { beforeEach, describe, expect, it, vi } from "vitest";

const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const state = vi.hoisted(() => ({ configured: true, requireUser: vi.fn(), createClient: vi.fn(), createAdminClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../lib/auth", () => ({ requireUser: state.requireUser }));
vi.mock("../lib/supabase/config", () => ({ isSupabaseConfigured: () => state.configured }));
vi.mock("../lib/supabase/server", () => ({ createClient: state.createClient }));
vi.mock("../lib/supabase/admin", () => ({ createAdminClient: state.createAdminClient }));
import { getCollegeContext, requireUploadCollege } from "../lib/colleges";
import { resolveLoginEmail } from "../lib/login-identity";
import { safeLoginDestination } from "../lib/access-crypto";

const viewer = { role: "viewer", email: "a@example.test", collegeId: A, username: "viewer1.rcoem", subject: "supabase:user-a" } as const;
const colleges = [{ id: A, code: "RCOEM", name: "RCOEM" }, { id: B, code: "YCCE", name: "YCCE" }];
beforeEach(() => {
  vi.resetAllMocks(); state.configured = true;
  state.requireUser.mockResolvedValue(viewer);
  state.createClient.mockImplementation(async () => ({ from: () => {
    let id: string | null = null;
    const q = { select: () => q, order: () => q, range: () => q, eq: (key: string, value: string) => { if (key === "id") id = value; return q; }, then: (resolve: (value: unknown) => void) => resolve({ data: id ? colleges.filter((c) => c.id === id) : colleges, error: null }) };
    return q;
  } }));
});

describe("College context authorization", () => {
  it("automatically opens only the viewer's assigned college", async () => {
    expect(await getCollegeContext()).toEqual({ college: colleges[0], colleges: [colleges[0]] });
  });
  it("rejects forged college selections before a data query", async () => {
    await expect(getCollegeContext(B)).rejects.toThrow("COLLEGE_FORBIDDEN");
    expect(state.createClient).not.toHaveBeenCalled();
  });
  it("fails closed for unassigned viewers and missing sessions", async () => {
    state.requireUser.mockResolvedValue({ ...viewer, collegeId: null });
    await expect(getCollegeContext()).rejects.toThrow("COLLEGE_ASSIGNMENT_REQUIRED");
    state.requireUser.mockResolvedValue(null);
    await expect(getCollegeContext()).rejects.toThrow("UNAUTHENTICATED");
  });
  it("lets only the platform administrator select another college", async () => {
    state.requireUser.mockResolvedValue({ ...viewer, role: "admin", collegeId: null });
    expect((await getCollegeContext(B)).college).toEqual(colleges[1]);
    await expect(requireUploadCollege(A, viewer)).rejects.toThrow("FORBIDDEN");
  });
  it("rejects missing or malformed upload destinations instead of selecting a default", async () => {
    const admin = { ...viewer, role: "admin" as const };
    await expect(requireUploadCollege(null, admin)).rejects.toThrow("INVALID_COLLEGE");
    await expect(requireUploadCollege("RCOEM", admin)).rejects.toThrow("INVALID_COLLEGE");
  });
  it("does not allow a live college URL to silently load demo data", async () => {
    state.configured = false;
    await expect(getCollegeContext(A)).rejects.toThrow("COLLEGE_UNAVAILABLE");
  });
});

describe("Username aliases", () => {
  it("resolves a normalized username to the current Auth email using its immutable user ID", async () => {
    const eq = vi.fn(() => ({ maybeSingle: async () => ({ data: { id: "auth-user-a" }, error: null }) }));
    const getUserById = vi.fn(async () => ({ data: { user: { email: "current-email@example.test" } }, error: null }));
    state.createAdminClient.mockReturnValue({ from: () => ({ select: () => ({ eq }) }), auth: { admin: { getUserById } } });
    expect(await resolveLoginEmail(" Viewer1.RCOEM ")).toBe("current-email@example.test");
    expect(eq).toHaveBeenCalledWith("username", "viewer1.rcoem");
    expect(getUserById).toHaveBeenCalledWith("auth-user-a");
  });
  it("does not infer an account or college from a suffix", async () => {
    const getUserById = vi.fn();
    state.createAdminClient.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }), auth: { admin: { getUserById } } });
    expect(await resolveLoginEmail("unknown.RCOEM")).toBeNull();
    expect(getUserById).not.toHaveBeenCalled();
  });
  it("preserves normal email login", async () => {
    expect(await resolveLoginEmail(" Person@Example.test ")).toBe("person@example.test");
    expect(state.createAdminClient).not.toHaveBeenCalled();
  });
});

describe("College return URLs", () => {
  it.each(["", "/admin", "/students", "/students/ABC%2001", "?report=1"])("preserves the college for %s", (suffix) => {
    const path = `/dashboard/colleges/${A}${suffix}`;
    expect(safeLoginDestination(path)).toBe(path);
  });
  it.each(["/../admin", "/students/%2e%2e", "/students/%2Fsecret", "?next=//foreign.example", "/admin#anything"])("rejects unsafe college suffix %s", (suffix) => {
    expect(safeLoginDestination(`/dashboard/colleges/${A}${suffix}`)).toBe("/dashboard");
  });
});

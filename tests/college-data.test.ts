import { beforeEach, describe, expect, it, vi } from "vitest";
import demo from "../data/demo-data.json";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), getCollegeContext: vi.fn(), createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("../lib/colleges", () => ({ getCollegeContext: mocks.getCollegeContext }));
vi.mock("../lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("../lib/supabase/server", () => ({ createClient: mocks.createClient }));
import { getDashboardBundle } from "../lib/data";

const college = { id: "10000000-0000-4000-8000-000000000001", code: "RCOEM", name: "RCOEM" };
const queries: { table: string; filters: Record<string, unknown>; offset: number }[] = [];
let fail = false;
beforeEach(() => {
  vi.resetAllMocks(); queries.length = 0; fail = false;
  mocks.requireUser.mockResolvedValue({ role: "viewer", collegeId: college.id, email: "a@example.test" });
  mocks.getCollegeContext.mockResolvedValue({ college, colleges: [college] });
  mocks.createClient.mockResolvedValue({ from: (table: string) => {
    const query = { table, filters: {} as Record<string, unknown>, offset: 0 }; queries.push(query);
    let single = false;
    const q = { select: () => q, eq: (key: string, value: unknown) => { query.filters[key] = value; return q; }, order: () => q, limit: () => q,
      maybeSingle: () => { single = true; return q; }, range: (offset: number) => { query.offset = offset; return q; },
      then: (resolve: (result: unknown) => void) => {
        if (fail) return resolve({ error: { message: "Unavailable" }, data: null });
        let data: unknown = null;
        if (table === "dataset_versions") data = single ? { id: "active", validation_summary: demo.quality } : [];
        if (table === "student_records") data = Array.from({ length: Math.min(500, 1001 - query.offset) }, (_, i) => ({ data: { ...demo.students[0], uid: `RCOEM-${query.offset + i}` } }));
        resolve({ data, error: null });
      } };
    return q;
  } });
});
describe("College dashboard data loading", () => {
  it("loads all students beyond the database's default row limit and scopes every query", async () => {
    const result = await getDashboardBundle(college.id);
    expect(result.students).toHaveLength(1001);
    expect(new Set(result.students.map((student) => student.uid)).size).toBe(1001);
    expect(result.settings.instituteName).toBe("RCOEM");
    expect(queries.every((query) => query.filters.college_id === college.id)).toBe(true);
    expect(queries.filter((query) => query.table === "student_records").map((query) => query.offset)).toEqual([0, 500, 1000]);
    expect(queries.filter((query) => query.table === "student_records").every((query) => query.filters.dataset_id === "active")).toBe(true);
  });
  it("does not return an empty or demo dashboard when a live query fails", async () => {
    fail = true;
    await expect(getDashboardBundle(college.id)).rejects.toThrow("DASHBOARD_UNAVAILABLE");
  });
  it("checks access before loading any dashboard data", async () => {
    mocks.getCollegeContext.mockRejectedValue(new Error("COLLEGE_FORBIDDEN"));
    await expect(getDashboardBundle(college.id)).rejects.toThrow("COLLEGE_FORBIDDEN");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

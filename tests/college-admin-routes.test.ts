import { beforeEach, describe, expect, it, vi } from "vitest";
import demo from "../data/demo-data.json";

const guards = vi.hoisted(() => ({ requireAdmin: vi.fn(), requireUploadCollege: vi.fn(), createAdminClient: vi.fn(), parseFile: vi.fn(), getPreview: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAdmin: guards.requireAdmin }));
vi.mock("@/lib/colleges", () => ({ requireUploadCollege: guards.requireUploadCollege }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: guards.createAdminClient }));
vi.mock("@/lib/upload", () => ({ parseFile: guards.parseFile, getPreview: guards.getPreview, sanitizeFilename: (s: string) => s }));
vi.mock("next/cache", () => ({ revalidatePath: guards.revalidatePath }));
import { POST as importFile } from "../app/api/admin/import/route";
import { POST as validate } from "../app/api/admin/validate/route";
import { POST as activate } from "../app/api/admin/activate/route";
import { POST as saveSettings } from "../app/api/admin/settings/route";

const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const DATASET = "30000000-0000-4000-8000-000000000001";
const admin = { email: "admin@example.test", role: "admin", subject: "supabase:admin" };
const insert = vi.fn(), upsert = vi.fn(), update = vi.fn(), rpc = vi.fn(), upload = vi.fn();
let lookupCollege: string | undefined;
function request(body: unknown, file = false) {
  const headers = { Origin: "http://localhost:3000" };
  if (file) {
    const form = new FormData(); form.set("file", new File(["fixture"], "college.xlsx"));
    if (body) form.set("collegeId", String(body));
    return new Request("http://localhost:3000/api/admin/import", { method: "POST", headers, body: form });
  }
  return new Request("http://localhost:3000/api/admin/action", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks(); lookupCollege = undefined;
  guards.requireAdmin.mockResolvedValue(admin);
  guards.requireUploadCollege.mockImplementation(async (value) => { if (![A, B].includes(value)) throw new Error("INVALID_COLLEGE"); return { id: value, name: value === A ? "RCOEM" : "YCCE" }; });
  guards.parseFile.mockResolvedValue({ canActivate: true, records: demo.students.slice(0, 2), quality: { ...demo.quality, validRecords: 2 }, columnMapping: [] });
  guards.getPreview.mockResolvedValue({ canActivate: true });
  upload.mockResolvedValue({ error: null }); rpc.mockResolvedValue({ error: null }); upsert.mockResolvedValue({ error: null }); insert.mockResolvedValue({ error: null });
  guards.createAdminClient.mockReturnValue({ from: (table: string) => {
    const chain = { eq: (key: string, value: string) => { if (key === "college_id") lookupCollege = value; return chain; }, then: (resolve: (v: unknown) => void) => resolve({ error: null }), maybeSingle: async () => ({ data: lookupCollege === A ? { import_status: "ready" } : null, error: null }) };
    return { insert: (rows: unknown) => insert(table, rows), upsert: (row: unknown) => upsert(table, row), update: (row: unknown) => { update(table, row); return chain; }, select: () => chain };
  }, rpc, storage: { from: () => ({ upload }) } });
});

describe("College administration endpoints", () => {
  it.each([["validate", validate], ["import", importFile], ["activate", activate], ["settings", saveSettings]] as const)("denies viewer writes to %s before accessing storage", async (_, route) => {
    guards.requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    expect((await route(request({}))).status).toBe(403);
    expect(guards.createAdminClient).not.toHaveBeenCalled();
    expect(guards.parseFile).not.toHaveBeenCalled();
  });
  it("requires an explicit college for both validation and import", async () => {
    expect((await validate(request(null, true))).status).toBe(400);
    expect((await importFile(request(null, true))).status).toBe(400);
    expect(guards.parseFile).not.toHaveBeenCalled();
    expect(guards.createAdminClient).not.toHaveBeenCalled();
  });
  it("compares an upload only against the selected college", async () => {
    expect((await validate(request(B, true))).status).toBe(200);
    expect(guards.getPreview).toHaveBeenCalledWith(expect.any(File), B);
  });
  it("associates every imported row, original file and activation with the selected college", async () => {
    const response = await importFile(request(B, true));
    expect(response.status).toBe(200);
    const { datasetId } = await response.json();
    expect(insert).toHaveBeenCalledWith("dataset_versions", expect.objectContaining({ college_id: B, id: datasetId }));
    expect(insert).toHaveBeenCalledWith("student_records", expect.arrayContaining([expect.objectContaining({ college_id: B, dataset_id: datasetId })]));
    expect(insert).toHaveBeenCalledWith("data_quality_results", expect.arrayContaining([expect.objectContaining({ college_id: B, dataset_id: datasetId })]));
    expect(upload.mock.calls[0][0]).toBe(`${B}/${datasetId}/college.xlsx`);
    expect(rpc).toHaveBeenCalledWith("activate_dataset", { p_college_id: B, p_dataset_id: datasetId });
    expect(guards.revalidatePath).toHaveBeenCalledWith(`/dashboard/colleges/${B}`, "layout");
  });
  it("never activates a workbook when storage fails", async () => {
    upload.mockResolvedValue({ error: new Error("Storage unavailable") });
    expect((await importFile(request(A, true))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith("dataset_versions", { import_status: "failed" });
  });
  it("never creates a dataset when workbook validation fails", async () => {
    guards.parseFile.mockResolvedValue({ canActivate: false, quality: demo.quality });
    expect((await importFile(request(A, true))).status).toBe(422);
    expect(guards.createAdminClient).not.toHaveBeenCalled();
  });
  it("rejects restoring a dataset belonging to a different college", async () => {
    expect((await activate(request({ collegeId: B, datasetId: DATASET }))).status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
    expect((await activate(request({ collegeId: A, datasetId: DATASET }))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("activate_dataset", { p_college_id: A, p_dataset_id: DATASET });
  });
  it("stores settings only under the selected college", async () => {
    expect((await saveSettings(request({ collegeId: A, settings: demo.settings }))).status).toBe(200);
    expect(upsert).toHaveBeenCalledWith("dashboard_settings", expect.objectContaining({ college_id: A, settings: demo.settings }));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import demoData from "../data/demo-data.json";
import type { DashboardBundle, StudentRecord } from "../lib/types";
import type { PlacementReport } from "../lib/placement-report";

const guards = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireUser: vi.fn(),
  hasAccessSession: vi.fn(),
  getDashboardBundle: vi.fn(),
  createPlacementPdf: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: guards.requireAdmin, requireUser: guards.requireUser }));
vi.mock("@/lib/access-session", () => ({ hasAccessSession: guards.hasAccessSession }));
vi.mock("@/lib/access-http", () => import("../lib/access-http"));
vi.mock("@/lib/data", () => ({ getDashboardBundle: guards.getDashboardBundle }));
vi.mock("@/lib/placement-pdf", () => ({ createPlacementPdf: guards.createPlacementPdf }));
vi.mock("@/lib/placement-report", () => import("../lib/placement-report"));

import { POST as downloadReport } from "../app/api/reports/pdf/route";
import { GET as accessSession } from "../app/api/auth/session/route";

const admin = { email: "placement@example.test", role: "admin", subject: "supabase:test-admin" };
const viewer = { email: "viewer@example.test", role: "viewer", subject: "supabase:test-viewer" };
const college = { id: "demo", code: "DEMO", name: "Sample college" };
const fixture = { ...demoData, students: demoData.students as StudentRecord[], demoMode: true, currentUser: null, college, colleges: [college] } as DashboardBundle;

function request(scope: unknown, origin: string | null = "http://localhost:3001", fetchSite = "same-origin") {
  const headers = new Headers({ "Content-Type": "application/json", "Sec-Fetch-Site": fetchSite });
  if (origin !== null) headers.set("Origin", origin);
  return new Request("http://localhost:3001/api/reports/pdf", { method: "POST", headers, body: JSON.stringify(scope && typeof scope === "object" ? { collegeId: "demo", ...scope } : scope) });
}

beforeEach(() => {
  vi.resetAllMocks();
  guards.requireAdmin.mockResolvedValue(admin);
  guards.requireUser.mockResolvedValue(admin);
  guards.hasAccessSession.mockResolvedValue(true);
  guards.getDashboardBundle.mockResolvedValue(fixture);
  guards.createPlacementPdf.mockImplementation(() => ({ output: () => new TextEncoder().encode("%PDF-1.7\nverified fixture").buffer }));
});

describe("Protected PDF endpoint", () => {
  it("passes the explicit college to the authorized loader", async () => {
    const id = "10000000-0000-4000-8000-000000000001";
    const response = await downloadReport(request({ type: "college", collegeId: id }));
    expect(response.status).toBe(200);
    expect(guards.getDashboardBundle).toHaveBeenCalledWith(id);
  });
  it("denies cross-college reports before generating a PDF", async () => {
    guards.getDashboardBundle.mockRejectedValue(new Error("COLLEGE_FORBIDDEN"));
    expect((await downloadReport(request({ type: "college" }))).status).toBe(403);
    expect(guards.createPlacementPdf).not.toHaveBeenCalled();
  });
  it("requires an explicit college instead of reporting on an administrator's default college", async () => {
    expect((await downloadReport(request({ type: "college", collegeId: undefined }))).status).toBe(400);
    expect(guards.getDashboardBundle).not.toHaveBeenCalled();
  });
  it("denies an unauthenticated request before reading the dataset or generating a report", async () => {
    guards.requireUser.mockRejectedValue(new Error("UNAUTHENTICATED"));
    const response = await downloadReport(request({ type: "college" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(guards.getDashboardBundle).not.toHaveBeenCalled();
    expect(guards.createPlacementPdf).not.toHaveBeenCalled();
  });

  it("denies a local-mode request with no active session", async () => {
    guards.requireUser.mockResolvedValue(null);
    const response = await downloadReport(request({ type: "college" }));
    expect(response.status).toBe(401);
    expect(guards.getDashboardBundle).not.toHaveBeenCalled();
    expect(guards.createPlacementPdf).not.toHaveBeenCalled();
  });

  it.each([
    ["https://foreign.example", "cross-site"],
    [null, "same-origin"],
    ["http://localhost:3001", "cross-site"],
  ])("rejects invalid request origins (%s / %s) before auth or data work", async (origin, fetchSite) => {
    const response = await downloadReport(request({ type: "college" }, origin, fetchSite!));
    expect(response.status).toBe(403);
    expect(guards.requireUser).not.toHaveBeenCalled();
    expect(guards.getDashboardBundle).not.toHaveBeenCalled();
    expect(guards.createPlacementPdf).not.toHaveBeenCalled();
  });

  it("returns an authenticated college PDF attachment built from the server dataset", async () => {
    guards.requireUser.mockResolvedValue(viewer);
    const response = await downloadReport(request({ type: "college" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="Overall-College-Report-.+\.pdf"; filename\*=UTF-8''/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toMatch(/^%PDF-/);
    const report = guards.createPlacementPdf.mock.calls[0][0] as PlacementReport;
    expect(report.scope).toEqual({ type: "college" });
    expect(report.summary.totalStudents).toBe(fixture.students.length);
    expect(report.comparisons.map((branch) => branch.name).sort()).toEqual([...new Set(fixture.students.map((student) => student.branch))].sort());
  });

  it("generates only the selected branch's metrics, cohorts and sections", async () => {
    const response = await downloadReport(request({ type: "branch", branch: "IT" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("IT-Branch-Report-");
    const report = guards.createPlacementPdf.mock.calls[0][0] as PlacementReport;
    const students = fixture.students.filter((student) => student.branch === "IT");
    expect(report.scope).toEqual({ type: "branch", branch: "IT" });
    expect(report.summary.totalStudents).toBe(students.length);
    expect(report.summary.branches).toBe(1);
    expect(report.comparisons.map((section) => section.name).sort()).toEqual([...new Set(students.map((student) => student.section))].sort());
  });

  it.each([
    null,
    { type: "all" },
    { type: "branch" },
    { type: "branch", branch: 42 },
    { type: "college", students: [{ branch: "forged" }] },
    { type: "college", settings: { instituteName: "forged" } },
    { type: "branch", branch: "IT", typeOverride: "college" },
  ])("rejects invalid or client-injected scope fields: %j", async (scope) => {
    const response = await downloadReport(request(scope));
    expect(response.status).toBe(400);
    expect(guards.getDashboardBundle).not.toHaveBeenCalled();
    expect(guards.createPlacementPdf).not.toHaveBeenCalled();
  });

  it("rejects an oversized authenticated scope body before dataset access", async () => {
    const response = await downloadReport(request({ type: "branch", branch: "x".repeat(5000) }));
    expect(response.status).toBe(413);
    expect(guards.requireUser).toHaveBeenCalledOnce();
    expect(guards.getDashboardBundle).not.toHaveBeenCalled();
    expect(guards.createPlacementPdf).not.toHaveBeenCalled();
  });

  it("does not fall back to a college report for an unavailable branch", async () => {
    const response = await downloadReport(request({ type: "branch", branch: "MISSING" }));
    expect(response.status).toBe(404);
    expect(guards.createPlacementPdf).not.toHaveBeenCalled();
  });

  it("returns a useful empty-dataset response without generating a PDF", async () => {
    guards.getDashboardBundle.mockResolvedValue({ ...fixture, students: [] });
    const response = await downloadReport(request({ type: "college" }));
    expect(response.status).toBe(422);
    expect(guards.createPlacementPdf).not.toHaveBeenCalled();
  });

  it("does not reveal internal generation errors", async () => {
    guards.createPlacementPdf.mockImplementation(() => { throw new Error("private-storage-key-example"); });
    const response = await downloadReport(request({ type: "college" }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private-storage-key-example");
  });
});

describe("Protected-session status endpoint", () => {
  it("returns unauthenticated status without exposing secrets", async () => {
    guards.requireUser.mockRejectedValue(new Error("UNAUTHENTICATED"));
    const response = await accessSession();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: null, protectedAccess: false });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps normal dashboard identity but marks an expired administrator session locked", async () => {
    guards.hasAccessSession.mockResolvedValue(false);
    const response = await accessSession();
    expect(await response.json()).toEqual({ user: { email: admin.email, role: "admin" }, protectedAccess: false });
  });

  it("does not treat a viewer as an administrator even with a protected cookie", async () => {
    guards.requireUser.mockResolvedValue({ ...admin, role: "viewer" });
    const response = await accessSession();
    expect(await response.json()).toEqual({ user: { email: admin.email, role: "viewer" }, protectedAccess: false });
    expect(guards.hasAccessSession).not.toHaveBeenCalled();
  });

  it("checks the current administrator subject and exposes only public identity fields", async () => {
    const response = await accessSession();
    expect(await response.json()).toEqual({ user: { email: admin.email, role: "admin" }, protectedAccess: true });
    expect(guards.hasAccessSession).toHaveBeenCalledWith(admin.subject);
  });
});

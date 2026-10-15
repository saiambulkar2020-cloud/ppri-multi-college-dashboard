import { describe, expect, it } from "vitest";
import demoData from "../data/demo-data.json";
import { DEFAULT_SETTINGS } from "../lib/constants";
import { buildPlacementReport, placementReportFilename, reportPackageIndex, type ReportInput } from "../lib/placement-report";
import { createPlacementPdf } from "../lib/placement-pdf";
import type { StudentRecord } from "../lib/types";

const input: ReportInput = { ...demoData, students: demoData.students as StudentRecord[], settings: DEFAULT_SETTINGS, demoMode: true };
const date = new Date("2026-09-08T05:00:00Z");

describe("Placement report scopes", () => {
  it("includes every active student and branch in the college report", () => {
    const report = buildPlacementReport(input, { type: "college" }, date);
    expect(report.summary.totalStudents).toBe(input.students.length);
    expect(report.comparisons.map((c) => c.name).sort()).toEqual([...new Set(input.students.map((s) => s.branch))].sort());
    expect(report.summary.ready + report.summary.developing + report.summary.support).toBe(input.students.length);
    expect(report.summary.packages.reduce((n, p) => n + p.count, 0)).toBe(input.students.length);
  });
  it.each([...new Set(input.students.map((s) => s.branch))])("isolates %s, including metrics, cohorts and sections", (branch) => {
    const report = buildPlacementReport(input, { type: "branch", branch }, date);
    const only = input.students.filter((s) => s.branch === branch);
    expect(report.summary.totalStudents).toBe(only.length);
    expect(report.summary.branches).toBe(1);
    expect(report.summary.ready).toBe(only.filter((s) => s.piri >= input.settings.gradeThresholds.B).length);
    expect(report.comparisons.map((c) => c.name).sort()).toEqual([...new Set(only.map((s) => s.section))].sort());
    expect(report.comparisons.reduce((n, c) => n + c.totalStudents, 0)).toBe(only.length);
    expect(report.batches).toEqual([...new Set(only.map((s) => s.batch))].sort());
    expect(report.competencies.find((c) => c.key === "communicationSkill")?.average).toBeCloseTo(only.reduce((n, s) => n + s.competencies.communicationSkill, 0) / only.length, 2);
  });
  it("does not export another branch when the requested branch is absent", () => {
    expect(() => buildPlacementReport(input, { type: "branch", branch: "MISSING" })).toThrow("no students");
    expect(() => buildPlacementReport({ ...input, students: [] }, { type: "college" })).toThrow("no students");
  });
  it("uses configured thresholds, including exact boundaries, with no overlapping counts", () => {
    const scores = [6.99, 7, 7.99, 8, 10];
    const students = scores.map((piri, i) => ({ ...input.students[0], uid: String(i), piri }));
    const report = buildPlacementReport({ ...input, students }, { type: "college" });
    expect([report.summary.ready, report.summary.developing, report.summary.support]).toEqual([2, 2, 1]);
    const changed = buildPlacementReport({ ...input, students, settings: { ...DEFAULT_SETTINGS, gradeThresholds: { ...DEFAULT_SETTINGS.gradeThresholds, B: 7 }, supportPriorityThreshold: 6 } }, { type: "college" });
    expect([changed.summary.ready, changed.summary.developing, changed.summary.support]).toEqual([4, 1, 0]);
  });
  it("includes missing package values in the denominator and identifies 5+ potential", () => {
    const students = ["Rs. 8-10 LPA", "5-6 LPA", "3.5-4 LPA", "2.5-3 LPA", ""].map((estimatedPackage) => ({ ...input.students[0], estimatedPackage }));
    const report = buildPlacementReport({ ...input, students }, { type: "college" });
    expect(report.summary.packages.map((p) => p.count)).toEqual([1, 1, 1, 1, 1]);
    expect(report.summary.packagePotential).toBe(40);
    expect(reportPackageIndex("Not available")).toBe(4);
  });
  it("labels demo files and makes filenames safe", () => {
    const report = buildPlacementReport(input, { type: "college" }, date);
    expect(placementReportFilename(report)).toBe("Overall-College-Report-2026-09-08-DEMO.pdf");
    expect(placementReportFilename({ ...report, title: "A/B: Report", demoMode: false })).toBe("A-B--Report-2026-09-08.pdf");
  });
});

describe("PDF export", () => {
  it("produces a paginated PDF for both report scopes", () => {
    for (const scope of [{ type: "college" }, { type: "branch", branch: "IT" }] as const) {
      const report = buildPlacementReport(input, scope, date);
      const pdf = createPlacementPdf(report);
      expect(pdf.getNumberOfPages()).toBe(4);
      const buffer = pdf.output("arraybuffer");
      expect(Buffer.from(buffer).subarray(0, 5).toString()).toBe("%PDF-");
      expect(buffer.byteLength).toBeGreaterThan(5000);
    }
  });
  it("paginates larger colleges instead of dropping branches", () => {
    const students = Array.from({ length: 19 }, (_, i) => ({ ...input.students[0], uid: String(i), branch: `Department ${i + 1}` }));
    const report = buildPlacementReport({ ...input, students }, { type: "college" }, date);
    expect(report.comparisons).toHaveLength(19);
    expect(createPlacementPdf(report).getNumberOfPages()).toBeGreaterThanOrEqual(7);
  });
});

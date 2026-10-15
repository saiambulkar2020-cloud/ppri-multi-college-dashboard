import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import demo from "../data/demo-data.json";
import { createPlacementPdf } from "../lib/placement-pdf";
import { buildPlacementReport, placementReportFilename, type ReportInput, type ReportScope } from "../lib/placement-report";
import type { StudentRecord, DashboardSettings } from "../lib/types";

const input: ReportInput = { ...demo, students: demo.students as StudentRecord[], settings: demo.settings as DashboardSettings, demoMode: true };
const out = path.resolve("tmp/pdfs");
await mkdir(out, { recursive: true });
for (const scope of [{ type: "college" }, { type: "branch", branch: "IT" }] as ReportScope[]) {
  const report = buildPlacementReport(input, scope, new Date("2026-09-08T10:00:00Z"));
  const pdf = createPlacementPdf(report);
  const filename = path.join(out, placementReportFilename(report));
  await writeFile(filename, Buffer.from(pdf.output("arraybuffer")));
  console.log(`${filename} | ${pdf.getNumberOfPages()} pages | ${report.summary.totalStudents} students`);
}

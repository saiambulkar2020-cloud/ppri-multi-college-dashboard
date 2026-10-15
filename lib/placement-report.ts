import { average, competencyAverages, dashboardKpis } from "./analytics";
import { COMPETENCY_GROUPS } from "./constants";
import type { DashboardBundle, DashboardSettings, StudentRecord } from "./types";

export type ReportScope = { type: "college" } | { type: "branch"; branch: string };
export type ReportInput = Pick<DashboardBundle, "students" | "settings" | "quality" | "versions" | "demoMode">;

const PACKAGE_BANDS = ["8+ LPA", "5 to <8 LPA", "3.5 to <5 LPA", "Below 3.5 LPA", "Not specified"];

export function reportPackageIndex(band: string) {
  const match = band.match(/\d+(?:\.\d+)?/);
  if (!match) return 4;
  const lower = Number(match[0]);
  return lower >= 8 ? 0 : lower >= 5 ? 1 : lower >= 3.5 ? 2 : 3;
}

function summarize(students: StudentRecord[], settings: DashboardSettings) {
  const ready = students.filter((s) => s.piri >= settings.gradeThresholds.B).length;
  const support = students.filter((s) => s.piri < settings.gradeThresholds.B && s.piri < settings.supportPriorityThreshold).length;
  const developing = students.length - ready - support;
  const percent = (count: number) => students.length ? count / students.length * 100 : 0;
  const packages = PACKAGE_BANDS.map((name, index) => {
    const count = students.filter((s) => reportPackageIndex(s.estimatedPackage) === index).length;
    return { name, count, percent: percent(count) };
  });
  return {
    ...dashboardKpis(students), ready, support, developing,
    sections: new Set(students.map((s) => JSON.stringify([s.branch, s.section]))).size,
    readyRate: percent(ready), supportRate: percent(support), developingRate: percent(developing),
    packages, packagePotential: packages[0].percent + packages[1].percent,
    competency: average(students.flatMap((s) => Object.values(s.competencies))),
  };
}

export function buildPlacementReport(input: ReportInput, scope: ReportScope, generatedAt = new Date()) {
  // Select from the full active dataset, never from the screen's filtered subset.
  const students = scope.type === "college" ? input.students : input.students.filter((s) => s.branch === scope.branch);
  if (!students.length) throw new Error("There are no students in the selected report scope.");
  const groupKey = scope.type === "college" ? "branch" : "section";
  const names = [...new Set(students.map((s) => s[groupKey]))].sort();
  const comparisons = names.map((name) => ({
    name: name || "Unassigned", ...summarize(students.filter((s) => s[groupKey] === name), input.settings),
  })).sort((a, b) => b.readyRate - a.readyRate || b.averagePiri - a.averagePiri || a.name.localeCompare(b.name));
  const competencies = competencyAverages(students);
  const summary = summarize(students, input.settings);
  const activeVersion = input.versions.find((v) => v.active);
  const weakest = [...competencies].reverse().slice(0, 3);
  const trainingActions = weakest.map((c) => ({
    title: c.label,
    score: c.average,
    action: c.group === "technical" ? "Run guided problem-solving exercises and project reviews; reassess this skill after the next training cycle."
      : c.group === "hr" ? "Use mock interviews, group exercises and structured feedback; reassess this skill after the next training cycle."
      : c.group === "psychological" ? "Arrange mentoring and scenario-based practice; reassess this skill after the next training cycle."
      : "Use industry case studies and practical exposure activities; reassess this skill after the next training cycle.",
  }));
  return {
    scope, summary, comparisons, competencies, trainingActions,
    title: scope.type === "college" ? "Overall College Report" : `${scope.branch} Branch Report`,
    instituteName: input.settings.instituteName,
    demoMode: input.demoMode,
    generatedAt: generatedAt.toISOString(),
    importedAt: input.quality.importedAt,
    source: activeVersion?.filename ?? "Active dataset",
    sourceId: activeVersion?.id ?? "Not available",
    batches: [...new Set(students.map((s) => s.batch))].sort(),
    semesters: [...new Set(students.map((s) => s.semester))].sort(),
    readyThreshold: input.settings.gradeThresholds.B,
    supportThreshold: input.settings.supportPriorityThreshold,
    domains: COMPETENCY_GROUPS.map((g) => ({
      key: g.key, label: g.label,
      average: average(students.flatMap((s) => g.competencies.map((c) => s.competencies[c.key]))),
      competencies: g.competencies.map((c) => ({ ...c, average: competencies.find((v) => v.key === c.key)!.average })),
    })),
  };
}

export type PlacementReport = ReturnType<typeof buildPlacementReport>;

export function placementReportFilename(report: PlacementReport) {
  const safe = (s: string) => s.normalize("NFKC").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-").slice(0, 90);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(report.generatedAt));
  return `${safe(report.title)}-${date}${report.demoMode ? "-DEMO" : ""}.pdf`;
}

import { ALL_COMPETENCIES, DEFAULT_SETTINGS } from "./constants";
import type { CompetencyKey, DashboardSettings, Grade, StudentRecord } from "./types";

export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateTotalPiriScore(input: Pick<StudentRecord, "aptitude" | "coding" | "groupTotals">): number {
  return round2(input.aptitude + input.coding + input.groupTotals.hr + input.groupTotals.psychological + input.groupTotals.technical + input.groupTotals.industry);
}

export function calculatePiri(
  input: Pick<StudentRecord, "aptitude" | "coding" | "groupTotals">,
  weights: DashboardSettings["weights"] = DEFAULT_SETTINGS.weights,
): number {
  return round2(
    (input.aptitude * weights.aptitude +
      input.coding * weights.coding +
      input.groupTotals.hr * weights.hr +
      input.groupTotals.psychological * weights.psychological +
      input.groupTotals.technical * weights.technical +
      input.groupTotals.industry * weights.industry) /
      5,
  );
}

export function calculateGrade(
  piri: number,
  thresholds: DashboardSettings["gradeThresholds"] = DEFAULT_SETTINGS.gradeThresholds,
): Grade {
  if (piri >= thresholds["A+"]) return "A+";
  if (piri >= thresholds.A) return "A";
  if (piri >= thresholds["B+"]) return "B+";
  if (piri >= thresholds.B) return "B";
  if (piri >= thresholds["C+"]) return "C+";
  if (piri >= thresholds.C) return "C";
  if (piri >= thresholds.D) return "D";
  return "F";
}

export function calculateEstimatedPackage(piri: number): string {
  if (piri >= 9.5) return "₹10-15 LPA";
  if (piri >= 9) return "₹8-10 LPA";
  if (piri >= 8.5) return "₹6-8 LPA";
  if (piri >= 8) return "₹5-6 LPA";
  if (piri >= 7.5) return "₹4-5 LPA";
  if (piri >= 7) return "₹3.5-4 LPA";
  if (piri >= 6) return "₹3-3.5 LPA";
  return "₹2.5-3 LPA";
}

export function competencyExtremes(competencies: Record<CompetencyKey, number>) {
  const ranked = ALL_COMPETENCIES.map(({ key, label }) => ({ key, label, score: competencies[key] })).sort(
    (a, b) => b.score - a.score || a.label.localeCompare(b.label),
  );
  return { strongest: ranked[0], weakest: ranked.at(-1)!, topThree: ranked.slice(0, 3), bottomThree: ranked.slice(-3).reverse() };
}

import { ALL_COMPETENCIES, GRADE_ORDER } from "./constants";
import { competencyExtremes, round2 } from "./calculations";
import type { CompetencyKey, DashboardFilters, StudentRecord } from "./types";

export const average = (values: number[]) => (values.length ? round2(values.reduce((sum, value) => sum + value, 0) / values.length) : 0);

export const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return round2(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
};

export function filterStudents(students: StudentRecord[], filters: DashboardFilters) {
  return students.filter((student) =>
    (Object.keys(filters) as Array<keyof DashboardFilters>).every((key) => !filters[key] || student[key] === filters[key]),
  );
}

export function gradeDistribution(students: StudentRecord[]) {
  return GRADE_ORDER.map((grade) => ({ name: grade, value: students.filter((student) => student.grade === grade).length }));
}

export function packageDistribution(students: StudentRecord[]) {
  const counts = new Map<string, number>();
  students.forEach((student) => counts.set(student.estimatedPackage, (counts.get(student.estimatedPackage) ?? 0) + 1));
  return [...counts.entries()].map(([name, value]) => ({ name, value }));
}

export function groupSummary(students: StudentRecord[], key: "branch" | "section") {
  const groups = new Map<string, StudentRecord[]>();
  students.forEach((student) => groups.set(student[key], [...(groups.get(student[key]) ?? []), student]));
  return [...groups.entries()]
    .map(([name, values]) => ({
      name,
      count: values.length,
      piri: average(values.map((student) => student.piri)),
      aptitude: average(values.map((student) => student.aptitude)),
      coding: average(values.map((student) => student.coding)),
      grades: Object.fromEntries(gradeDistribution(values).map((item) => [item.name, item.value])),
      packages: Object.fromEntries(packageDistribution(values).map((item) => [item.name, item.value])),
    }))
    .sort((a, b) => b.piri - a.piri);
}

export function competencyAverages(students: StudentRecord[]) {
  return ALL_COMPETENCIES.map(({ key, label, group, groupLabel }) => ({
    key,
    label,
    group,
    groupLabel,
    average: average(students.map((student) => student.competencies[key])),
    gap: round2(5 - average(students.map((student) => student.competencies[key]))),
  })).sort((a, b) => b.average - a.average);
}

export function competencyHeatmap(students: StudentRecord[], by: "branch" | "section") {
  const names = [...new Set(students.map((student) => student[by]))].sort();
  return names.map((name) => {
    const values = students.filter((student) => student[by] === name);
    return {
      name,
      values: Object.fromEntries(
        ALL_COMPETENCIES.map(({ key }) => [key, average(values.map((student) => student.competencies[key]))]),
      ) as Record<CompetencyKey, number>,
    };
  });
}

export function groupCompetencyExtremes(students: StudentRecord[], by: "branch" | "section") {
  return [...new Set(students.map((student) => student[by]))].sort().map((name) => {
    const subset = students.filter((student) => student[by] === name);
    const averages = competencyAverages(subset);
    return { name, strongest: averages[0], weakest: averages.at(-1)! };
  });
}

export function studentSummary(student: StudentRecord) {
  return competencyExtremes(student.competencies);
}

export function dashboardKpis(students: StudentRecord[]) {
  const piris = students.map((student) => student.piri);
  return {
    totalStudents: students.length,
    averagePiri: average(piris),
    medianPiri: median(piris),
    highestPiri: piris.length ? Math.max(...piris) : 0,
    averageAptitude: average(students.map((student) => student.aptitude)),
    averageCoding: average(students.map((student) => student.coding)),
    branches: new Set(students.map((student) => student.branch)).size,
    sections: new Set(students.map((student) => student.section)).size,
  };
}

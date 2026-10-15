import type { StudentRecord } from "./types";
import { competencyExtremes } from "./calculations";

const escape = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function studentsToCsv(students: StudentRecord[]) {
  const headers = ["UID", "Student Name", "Batch", "Semester", "Branch", "Section", "Aptitude", "Coding", "PIRI", "Grade", "Estimated Package", "Result", "Strongest Competency", "Weakest Competency"];
  const rows = students.map((student) => {
    const extremes = competencyExtremes(student.competencies);
    return [student.uid, student.name, student.batch, student.semester, student.branch, student.section, student.aptitude, student.coding, student.piri, student.grade, student.estimatedPackage, student.result ?? "Result Not Available", extremes.strongest.label, extremes.weakest.label];
  });
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

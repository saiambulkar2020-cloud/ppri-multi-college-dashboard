import fs from "node:fs/promises";
import { ALL_COMPETENCIES, COMPETENCY_GROUPS, DEFAULT_SETTINGS } from "../lib/constants";
import { calculateEstimatedPackage, calculateGrade, calculatePiri, calculateTotalPiriScore, round2 } from "../lib/calculations";
import type { CompetencyKey, DataQualitySummary, DatasetVersion, GroupKey, StudentRecord } from "../lib/types";

// This generator has no workbook input. Every student and assessment is fictional.
// Fixed formulas and a fixed timestamp make the public demo reproducible.
const generatedAt = "2026-01-01T00:00:00.000Z";
const branches = ["CSE", "CIVIL", "IT", "MECH"];
const students: StudentRecord[] = Array.from({ length: 40 }, (_, index) => {
  const ordinal = String(index + 1).padStart(3, "0");
  const competencies = Object.fromEntries(ALL_COMPETENCIES.map(({ key }, competencyIndex) => [
    key,
    1 + ((index * 7 + competencyIndex * 3 + Math.floor(index / 4)) % 5),
  ])) as Record<CompetencyKey, number>;
  const groupTotals = Object.fromEntries(COMPETENCY_GROUPS.map(({ key, competencies: group }) => [
    key,
    group.reduce((total, competency) => total + competencies[competency.key], 0),
  ])) as Record<GroupKey, number>;
  const base = {
    aptitude: round2(48.37 + ((index * 17) % 49)),
    coding: round2(35.63 + ((index * 23) % 63)),
    groupTotals,
  };
  const totalPiriScore = calculateTotalPiriScore(base);
  const piri = calculatePiri(base);
  const grade = calculateGrade(piri);
  return {
    uid: `SYNTH-${ordinal}`,
    name: `Demo Student ${ordinal}`,
    batch: String(2027 + (Math.floor(index / 8) % 2)),
    semester: index % 2 === 0 ? "VI" : "VIII",
    branch: branches[index % branches.length],
    section: Math.floor(index / branches.length) % 2 === 0 ? "A" : "B",
    ...base,
    competencies,
    totalPiriScore,
    recalculatedTotalPiriScore: totalPiriScore,
    piri,
    recalculatedPiri: piri,
    grade,
    recalculatedGrade: grade,
    estimatedPackage: calculateEstimatedPackage(piri),
    result: null,
    remark: `Fictional assessment ${ordinal}; generated for dashboard demonstrations only.`,
    review: `Synthetic example ${ordinal}. Scores and package estimates do not describe a real student.`,
    calculationFlags: { totalMismatch: false, piriMismatch: false, gradeMismatch: false },
  };
});

// Public workbook schema, independent of any uploaded workbook or student record.
const headers: Array<[string, string]> = [
  ["Sr No", "Sr No"],
  ["UID", "UID"],
  ["BATCH", "Batch"],
  ["NAME OF STUDENT", "Student Name"],
  ["SEMESTER", "Semester"],
  ["BRANCH", "Branch"],
  ["SECTION", "Section"],
  ["APTITUDE SCORE", "Aptitude Score"],
  ["CODING SCORE", "Coding Score"],
  ["COMMUNICATION SKILL", "Communication Skill"],
  ["TEAMWORK & LEADERSHIP", "Teamwork & Leadership"],
  ["ETHICAL VALUES & PROFESSIONAL CONDUCT", "Ethical Values & Professional Conduct"],
  ["WORKPLACE ETIQUETTE & PRESENTATION", "Workplace Etiquette & Presentation"],
  ["TOTAL HR SCORE", "HR & Professional Qualities Total"],
  ["EMOTIONAL INTELLIGENCE", "Emotional Intelligence"],
  ["STRESS HANDLING & RESILIENCE", "Stress Handling & Resilience"],
  ["STRESS TOLERENCE", "Stress Tolerance"],
  ["ADAPT0ILITY & GROWTH MINDSET", "Adaptability & Growth Mindset"],
  ["TOTAL HR SCORE", "Psychological & Behavioural Readiness Total"],
  ["CORE SUBJECT KNOWLEDGE", "Core Subject Knowledge"],
  ["APPLIED PROBLEM SOLVING", "Applied Problem Solving"],
  ["TOOL PROFICIENCY", "Tool Proficiency"],
  ["PROJECT OR MINI PROJECT EVALUATION", "Project or Mini Project Evaluation"],
  ["TOTAL HR SCORE", "Technical Interview Total"],
  ["EXTERNAL PROJECT DEVELOPMENT", "External Project Development"],
  ["INTERNSHIP/EXPERIENCE", "Internship/Experience"],
  ["PROGRAMMING SKILLS/SOFTWARE/DESIGN KNOWLEDGE", "Programming Skills/Software/Design Knowledge"],
  ["CORPORATE CULTURE AWARENESS", "Corporate Culture Awareness"],
  ["TOTAL TECHNICAL SCORE", "Industry Awareness & Application Skills Total"],
  ["TOTAL PIRI SCORE", "Total PIRI Score"],
  ["RESULT", "Result"],
  ["PIRI", "PIRI"],
  ["PPRI GRADES", "PPRI Grade"],
  ["Estimated Package", "Estimated Package"],
  ["REMARK", "Remark"],
  ["REVIEW", "Review"],
];
const columnMapping = headers.map(([original, cleaned], index) => ({ original, cleaned, column: index + 1 }));
const quality: DataQualitySummary = {
  recordsLoaded: students.length,
  validRecords: students.length,
  validUidCount: students.length,
  duplicateUids: [],
  missingUidCount: 0,
  missingValueCount: 0,
  invalidScoreCount: 0,
  missingResultCount: students.length,
  calculationMismatchCount: 0,
  genericReviewCount: students.length,
  detectedHeaderRow: 3,
  sourceColumnCount: headers.length,
  importedAt: generatedAt,
};
const versions: DatasetVersion[] = [{
  id: "synthetic-demo-v1",
  filename: "synthetic-demo.json",
  createdAt: generatedAt,
  uploadedBy: "Deterministic synthetic demo generator",
  totalRecords: students.length,
  validRecords: students.length,
  active: true,
  validationSummary: quality,
}];
const payload = {
  students,
  quality,
  settings: {
    ...DEFAULT_SETTINGS,
    instituteName: "Demo College Career Readiness Team",
    footerText: "Synthetic demonstration data — no real students or assessments.",
  },
  versions,
  columnMapping,
};

await fs.writeFile(new URL("../data/demo-data.json", import.meta.url), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${students.length} fully synthetic records to data/demo-data.json.`);

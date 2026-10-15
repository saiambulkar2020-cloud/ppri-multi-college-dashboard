import ExcelJS from "exceljs";
import { ALL_COMPETENCIES, DEFAULT_SETTINGS } from "./constants";
import { calculateEstimatedPackage, calculateGrade, calculatePiri, calculateTotalPiriScore, round2 } from "./calculations";
import { detectDuplicateUids } from "./validation";
import type { CompetencyKey, DataQualitySummary, Grade, ParsedWorkbook, StudentRecord } from "./types";

type CellScalar = string | number | boolean | Date | null;

const canonicalHeader: Record<string, string> = {
  "SR NO": "Sr No",
  UID: "UID",
  BATCH: "Batch",
  "NAME OF STUDENT": "Student Name",
  SEMESTER: "Semester",
  BRANCH: "Branch",
  SECTION: "Section",
  "APTITUDE SCORE": "Aptitude Score",
  "CODING SCORE": "Coding Score",
  "COMMUNICATION SKILL": "Communication Skill",
  "TEAMWORK & LEADERSHIP": "Teamwork & Leadership",
  "ETHICAL VALUES & PROFESSIONAL CONDUCT": "Ethical Values & Professional Conduct",
  "WORKPLACE ETIQUETTE & PRESENTATION": "Workplace Etiquette & Presentation",
  "EMOTIONAL INTELLIGENCE": "Emotional Intelligence",
  "STRESS HANDLING & RESILIENCE": "Stress Handling & Resilience",
  "STRESS TOLERENCE": "Stress Tolerance",
  "ADAPT0ILITY & GROWTH MINDSET": "Adaptability & Growth Mindset",
  "CORE SUBJECT KNOWLEDGE": "Core Subject Knowledge",
  "APPLIED PROBLEM SOLVING": "Applied Problem Solving",
  "TOOL PROFICIENCY": "Tool Proficiency",
  "PROJECT OR MINI PROJECT EVALUATION": "Project or Mini Project Evaluation",
  "EXTERNAL PROJECT DEVELOPMENT": "External Project Development",
  "INTERNSHIP/EXPERIENCE": "Internship/Experience",
  "PROGRAMMING SKILLS/SOFTWARE/DESIGN KNOWLEDGE": "Programming Skills/Software/Design Knowledge",
  "CORPORATE CULTURE AWARENESS": "Corporate Culture Awareness",
  "TOTAL TECHNICAL SCORE": "Industry Awareness & Application Skills Total",
  "TOTAL PIRI SCORE": "Total PIRI Score",
  RESULT: "Result",
  PIRI: "PIRI",
  "PPRI GRADES": "PPRI Grade",
  "ESTIMATED PACKAGE": "Estimated Package",
  REMARK: "Remark",
  REVIEW: "Review",
};

export function cleanHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function scalar(value: ExcelJS.CellValue): CellScalar {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if ("result" in value) return scalar(value.result as ExcelJS.CellValue);
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("text" in value) return value.text;
  return String(value);
}

function asText(value: CellScalar): string {
  return value === null ? "" : String(value).trim();
}

function asNumber(value: CellScalar): number {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function approximatelyEqual(a: number, b: number, tolerance = 0.011) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
}

export function detectHeaderRow(rows: unknown[][]): number {
  const index = rows.findIndex((row) => {
    const headers = row.map(cleanHeader);
    return headers.includes("UID") && headers.includes("NAME OF STUDENT") && headers.includes("APTITUDE SCORE");
  });
  if (index < 0) throw new Error("Could not find the Excel header row. Expected UID, NAME OF STUDENT and APTITUDE SCORE.");
  return index + 1;
}

function buildHeaderMap(rawHeaders: unknown[]) {
  let totalHrOccurrence = 0;
  const columns = new Map<string, number>();
  const mapping: Array<{ original: string; cleaned: string; column: number }> = [];

  rawHeaders.forEach((raw, index) => {
    const header = cleanHeader(raw);
    if (!header) return;
    let cleaned = canonicalHeader[header] ?? String(raw).replace(/\s+/g, " ").trim();
    if (header === "TOTAL HR SCORE") {
      totalHrOccurrence += 1;
      cleaned = [
        "HR & Professional Qualities Total",
        "Psychological & Behavioural Readiness Total",
        "Technical Interview Total",
      ][totalHrOccurrence - 1] ?? `Unmapped Total HR Score ${totalHrOccurrence}`;
    }
    columns.set(cleaned, index + 1);
    mapping.push({ original: String(raw).trim(), cleaned, column: index + 1 });
  });
  return { columns, mapping };
}

function requiredColumn(columns: Map<string, number>, name: string): number {
  const column = columns.get(name);
  if (!column) throw new Error(`Required column “${name}” was not found in the PPRI worksheet.`);
  return column;
}

export async function parseExcelWorkbook(input: ArrayBuffer | Uint8Array | Buffer): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets.find((sheet) => sheet.name.trim().toUpperCase() === "PPRI");
  if (!worksheet) throw new Error('Worksheet "PPRI" was not found.');

  const firstRows = Array.from({ length: Math.min(20, worksheet.rowCount) }, (_, rowIndex) => {
    const row = worksheet.getRow(rowIndex + 1);
    return Array.from({ length: worksheet.columnCount }, (_, columnIndex) => scalar(row.getCell(columnIndex + 1).value));
  });
  const headerRowNumber = detectHeaderRow(firstRows);
  const headerRow = worksheet.getRow(headerRowNumber);
  const rawHeaders = Array.from({ length: worksheet.columnCount }, (_, index) => scalar(headerRow.getCell(index + 1).value));
  const { columns, mapping } = buildHeaderMap(rawHeaders);

  const col = (name: string) => requiredColumn(columns, name);
  const competencyColumns: Record<CompetencyKey, number> = {
    communicationSkill: col("Communication Skill"),
    teamworkLeadership: col("Teamwork & Leadership"),
    ethicalConduct: col("Ethical Values & Professional Conduct"),
    workplaceEtiquette: col("Workplace Etiquette & Presentation"),
    emotionalIntelligence: col("Emotional Intelligence"),
    stressHandling: col("Stress Handling & Resilience"),
    stressTolerance: col("Stress Tolerance"),
    adaptability: col("Adaptability & Growth Mindset"),
    coreSubjectKnowledge: col("Core Subject Knowledge"),
    appliedProblemSolving: col("Applied Problem Solving"),
    toolProficiency: col("Tool Proficiency"),
    projectEvaluation: col("Project or Mini Project Evaluation"),
    externalProjectDevelopment: col("External Project Development"),
    internshipExperience: col("Internship/Experience"),
    programmingSkills: col("Programming Skills/Software/Design Knowledge"),
    corporateCulture: col("Corporate Culture Awareness"),
  };

  const candidates: Array<{ row: number; uid: string; record: StudentRecord; invalidScore: boolean; missingValues: number }> = [];
  let recordsLoaded = 0;
  let missingUidCount = 0;
  let missingValueCount = 0;
  let invalidScoreCount = 0;
  let missingResultCount = 0;
  let calculationMismatchCount = 0;
  let genericReviewCount = 0;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rowValues = Array.from({ length: worksheet.columnCount }, (_, index) => scalar(row.getCell(index + 1).value));
    if (rowValues.every((value) => asText(value) === "")) continue;
    recordsLoaded += 1;
    const get = (name: string) => scalar(row.getCell(col(name)).value);
    const uid = asText(get("UID"));
    if (!uid) missingUidCount += 1;

    const aptitude = asNumber(get("Aptitude Score"));
    const coding = asNumber(get("Coding Score"));
    const competencies = Object.fromEntries(
      Object.entries(competencyColumns).map(([key, column]) => [key, asNumber(scalar(row.getCell(column).value))]),
    ) as Record<CompetencyKey, number>;
    const scoreValues = [aptitude, coding, ...Object.values(competencies)];
    const invalidScore =
      !Number.isFinite(aptitude) ||
      !Number.isFinite(coding) ||
      aptitude < 0 ||
      aptitude > 100 ||
      coding < 0 ||
      coding > 100 ||
      Object.values(competencies).some((score) => !Number.isFinite(score) || score < 1 || score > 5);
    if (invalidScore) invalidScoreCount += 1;

    const groupTotals = {
      hr: asNumber(get("HR & Professional Qualities Total")),
      psychological: asNumber(get("Psychological & Behavioural Readiness Total")),
      technical: asNumber(get("Technical Interview Total")),
      industry: asNumber(get("Industry Awareness & Application Skills Total")),
    };
    const calculatedGroupTotals = {
      hr: round2(competencies.communicationSkill + competencies.teamworkLeadership + competencies.ethicalConduct + competencies.workplaceEtiquette),
      psychological: round2(competencies.emotionalIntelligence + competencies.stressHandling + competencies.stressTolerance + competencies.adaptability),
      technical: round2(competencies.coreSubjectKnowledge + competencies.appliedProblemSolving + competencies.toolProficiency + competencies.projectEvaluation),
      industry: round2(competencies.externalProjectDevelopment + competencies.internshipExperience + competencies.programmingSkills + competencies.corporateCulture),
    };
    for (const key of Object.keys(groupTotals) as Array<keyof typeof groupTotals>) {
      if (!Number.isFinite(groupTotals[key])) groupTotals[key] = calculatedGroupTotals[key];
    }

    const base = { aptitude, coding, groupTotals };
    const recalculatedTotalPiriScore = calculateTotalPiriScore(base as Pick<StudentRecord, "aptitude" | "coding" | "groupTotals">);
    const recalculatedPiri = calculatePiri(base as Pick<StudentRecord, "aptitude" | "coding" | "groupTotals">);
    const sourceTotal = asNumber(get("Total PIRI Score"));
    const sourcePiri = asNumber(get("PIRI"));
    const sourceGradeText = asText(get("PPRI Grade"));
    const recalculatedGrade = calculateGrade(recalculatedPiri);
    const grade = (sourceGradeText || recalculatedGrade) as Grade;
    const totalPiriScore = Number.isFinite(sourceTotal) ? sourceTotal : recalculatedTotalPiriScore;
    const piri = Number.isFinite(sourcePiri) ? round2(sourcePiri) : recalculatedPiri;
    const calculationFlags = {
      totalMismatch: !approximatelyEqual(totalPiriScore, recalculatedTotalPiriScore),
      piriMismatch: !approximatelyEqual(piri, recalculatedPiri),
      gradeMismatch: grade !== recalculatedGrade,
    };
    if (Object.values(calculationFlags).some(Boolean)) calculationMismatchCount += 1;

    const resultText = asText(get("Result"));
    if (!resultText) missingResultCount += 1;
    const review = asText(get("Review"));
    if (review) genericReviewCount += 1;

    const requiredText = [get("Student Name"), get("Batch"), get("Semester"), get("Branch"), get("Section")];
    const rowMissingValues = requiredText.filter((value) => !asText(value)).length + scoreValues.filter((value) => !Number.isFinite(value)).length;
    missingValueCount += rowMissingValues;

    candidates.push({
      row: rowNumber,
      uid,
      invalidScore,
      missingValues: rowMissingValues,
      record: {
        uid,
        batch: asText(get("Batch")),
        name: asText(get("Student Name")),
        semester: asText(get("Semester")),
        branch: asText(get("Branch")),
        section: asText(get("Section")),
        aptitude,
        coding,
        competencies,
        groupTotals,
        totalPiriScore,
        recalculatedTotalPiriScore,
        piri,
        recalculatedPiri,
        grade,
        recalculatedGrade,
        estimatedPackage: asText(get("Estimated Package")) || calculateEstimatedPackage(recalculatedPiri),
        result: resultText || null,
        remark: asText(get("Remark")),
        review,
        calculationFlags,
      },
    });
  }

  const duplicateUids = detectDuplicateUids(candidates.map((candidate) => candidate.uid));
  const duplicateSet = new Set(duplicateUids);
  const records = candidates
    .filter((candidate) => candidate.uid && !duplicateSet.has(candidate.uid) && !candidate.invalidScore && candidate.missingValues === 0)
    .map((candidate) => candidate.record);
  const reviews = candidates.map((candidate) => candidate.record.review).filter(Boolean);
  const reviewCounts = new Map<string, number>();
  reviews.forEach((review) => reviewCounts.set(review, (reviewCounts.get(review) ?? 0) + 1));
  genericReviewCount = [...reviewCounts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);

  const quality: DataQualitySummary = {
    recordsLoaded,
    validRecords: records.length,
    validUidCount: new Set(candidates.map((candidate) => candidate.uid).filter(Boolean)).size,
    duplicateUids,
    missingUidCount,
    missingValueCount,
    invalidScoreCount,
    missingResultCount,
    calculationMismatchCount,
    genericReviewCount,
    detectedHeaderRow: headerRowNumber,
    sourceColumnCount: worksheet.columnCount,
    importedAt: new Date().toISOString(),
  };

  const canActivate = missingUidCount === 0 && duplicateUids.length === 0 && invalidScoreCount === 0 && missingValueCount === 0;
  const warnings = [
    ...(!canActivate ? ["Resolve missing UIDs, duplicate UIDs, invalid scores, or required blank cells before activation."] : []),
    ...(calculationMismatchCount ? [`${calculationMismatchCount} record(s) differ from recalculated values.`] : []),
    ...(missingResultCount ? ["RESULT is blank; the dashboard will display Result Not Available."] : []),
  ];
  return { records, quality, columnMapping: mapping, warnings, canActivate };
}

export function getCompetencyLabel(key: CompetencyKey) {
  return ALL_COMPETENCIES.find((competency) => competency.key === key)?.label ?? key;
}

export { DEFAULT_SETTINGS };

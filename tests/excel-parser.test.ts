import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { cleanHeader, detectHeaderRow, parseExcelWorkbook } from "../lib/excel-parser";
import { detectDuplicateUids } from "../lib/validation";

const headers = ["Sr No", "UID", "BATCH ", "NAME OF STUDENT", "SEMESTER", "BRANCH", "SECTION", "APTITUDE SCORE", "CODING SCORE", "COMMUNICATION SKILL ", "TEAMWORK & LEADERSHIP  ", "ETHICAL VALUES & PROFESSIONAL CONDUCT", "WORKPLACE ETIQUETTE & PRESENTATION ", "TOTAL HR SCORE", "EMOTIONAL INTELLIGENCE", "STRESS HANDLING & RESILIENCE", "STRESS TOLERENCE", "ADAPT0ILITY & GROWTH MINDSET", "TOTAL HR SCORE", "CORE SUBJECT KNOWLEDGE", "APPLIED PROBLEM SOLVING", "TOOL PROFICIENCY", "PROJECT OR MINI PROJECT EVALUATION", "TOTAL HR SCORE", "EXTERNAL PROJECT DEVELOPMENT", "INTERNSHIP/EXPERIENCE", "PROGRAMMING SKILLS/SOFTWARE/DESIGN KNOWLEDGE", "CORPORATE CULTURE AWARENESS", "TOTAL TECHNICAL SCORE", "TOTAL PIRI SCORE", "RESULT", " PIRI", "PPRI GRADES", "Estimated Package", "REMARK", "REVIEW"];

const validRow = [null, "UID-001", "2026", "TEST STUDENT", "VII", "CSE", "A", 86, 61, 4, 5, 4, 2, 15, 2, 4, 3, 3, 12, 3, 4, 5, 2, 14, 2, 3, 2, 2, 9, 197, null, 7.9, "C+", "₹4-5 LPA", "Remark", "Review"];

async function workbookBuffer(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("PPRI");
  sheet.addRow(["Test PPRI Report"]);
  sheet.addRow([null, null, "Group headings"]);
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

describe("Excel import", () => {
  it("detects the actual header row", () => expect(detectHeaderRow([["title"], ["groups"], headers])).toBe(3));
  it("cleans spaces and inconsistent heading text", () => expect(cleanHeader("  PPRI   Grades ")).toBe("PPRI GRADES"));
  it("detects duplicate UIDs", () => expect(detectDuplicateUids(["A", "B", "A", "B", "C"])).toEqual(["A", "B"]));
  it("maps repeated total headings by position", async () => {
    const result = await parseExcelWorkbook(await workbookBuffer([validRow]));
    expect(result.columnMapping.filter((item) => item.original === "TOTAL HR SCORE").map((item) => item.cleaned)).toEqual(["HR & Professional Qualities Total", "Psychological & Behavioural Readiness Total", "Technical Interview Total"]);
  });
  it("counts a missing UID and blocks activation", async () => {
    const row = [...validRow]; row[1] = null;
    const result = await parseExcelWorkbook(await workbookBuffer([row]));
    expect(result.quality.missingUidCount).toBe(1);
    expect(result.canActivate).toBe(false);
  });
  it("detects a score outside the 1–5 competency range", async () => {
    const row = [...validRow]; row[9] = 6;
    const result = await parseExcelWorkbook(await workbookBuffer([row]));
    expect(result.quality.invalidScoreCount).toBe(1);
  });
  it("keeps blank Result as null without inventing PASS or FAIL", async () => {
    const result = await parseExcelWorkbook(await workbookBuffer([validRow]));
    expect(result.records[0].result).toBeNull();
    expect(result.quality.missingResultCount).toBe(1);
  });
});

import "server-only";
import { parseExcelWorkbook } from "./excel-parser";
import { createClient } from "./supabase/server";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function validateUploadedFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Only .xlsx Excel workbooks are accepted.");
  if (file.type && file.type !== XLSX_MIME && file.type !== "application/octet-stream") throw new Error("The selected file is not a valid .xlsx workbook.");
  if (file.size <= 0) throw new Error("The selected workbook is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("The workbook exceeds the 4 MB upload limit.");
}

export function sanitizeFilename(filename: string) {
  const stem = filename.replace(/\.xlsx$/i, "").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 90) || "ppri-workbook";
  return `${stem}.xlsx`;
}

export async function parseFile(file: File) {
  validateUploadedFile(file);
  return parseExcelWorkbook(await file.arrayBuffer());
}

export async function activeUids(collegeId: string) {
  const admin = await createClient();
  const { data: active, error } = await admin.from("dataset_versions").select("id").eq("college_id", collegeId).eq("is_active", true).maybeSingle();
  if (error) throw new Error("The current college dataset could not be read.");
  if (!active) return new Set<string>();
  const uids = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("student_records").select("uid").eq("college_id", collegeId).eq("dataset_id", active.id).order("id").range(offset, offset + 499);
    if (error) throw new Error("The current college students could not be read.");
    for (const row of data ?? []) uids.add(row.uid);
    if (!data || data.length < 500) break;
  }
  return uids;
}

export async function getPreview(file: File, collegeId: string) {
  const parsed = await parseFile(file);
  const existing = await activeUids(collegeId);
  const updatedStudentCount = parsed.records.filter((record) => existing.has(record.uid)).length;
  return {
    filename: sanitizeFilename(file.name),
    newStudentCount: parsed.records.length - updatedStudentCount,
    updatedStudentCount,
    canActivate: parsed.canActivate,
    quality: parsed.quality,
    warnings: parsed.warnings,
  };
}

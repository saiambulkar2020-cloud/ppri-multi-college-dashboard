import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFile, sanitizeFilename } from "@/lib/upload";
import { requireUploadCollege } from "@/lib/colleges";
import { accessErrorResponse, assertSameOrigin } from "@/lib/access-http";
import { collegeDashboardPath } from "@/lib/college-path";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let datasetId: string | null = null;
  let collegeId: string | null = null;
  try {
    assertSameOrigin(request);
    const current = await requireAdmin();
    const form = await request.formData();
    const college = await requireUploadCollege(form.get("collegeId"), current);
    collegeId = college.id;
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an .xlsx workbook." }, { status: 400 });
    const parsed = await parseFile(file);
    if (!parsed.canActivate) return NextResponse.json({ error: "Critical workbook validation errors must be fixed before activation.", quality: parsed.quality }, { status: 422 });

    const admin = createAdminClient();
    datasetId = crypto.randomUUID();
    const safeFilename = sanitizeFilename(file.name);
    const storagePath = `${collegeId}/${datasetId}/${safeFilename}`;
    const { error: datasetError } = await admin.from("dataset_versions").insert({
      id: datasetId,
      college_id: collegeId,
      original_filename: safeFilename,
      storage_path: storagePath,
      uploaded_by: current.email,
      total_records: parsed.quality.recordsLoaded,
      valid_records: parsed.quality.validRecords,
      validation_summary: parsed.quality,
      column_mapping: parsed.columnMapping,
      is_active: false,
      import_status: "importing",
    });
    if (datasetError) throw datasetError;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: storageError } = await admin.storage.from("ppri-workbooks").upload(storagePath, bytes, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: false });
    if (storageError) throw storageError;

    const rows = parsed.records.map((student) => ({ college_id: collegeId, dataset_id: datasetId, uid: student.uid, student_name: student.name, branch: student.branch, section: student.section, batch: student.batch, semester: student.semester, piri: student.piri, grade: student.grade, estimated_package: student.estimatedPackage, data: student }));
    for (let index = 0; index < rows.length; index += 500) {
      const { error: recordsError } = await admin.from("student_records").insert(rows.slice(index, index + 500));
      if (recordsError) throw recordsError;
    }

    const qualityChecks = [
      { check_name: "duplicate_uids", severity: parsed.quality.duplicateUids.length ? "error" : "info", affected_count: parsed.quality.duplicateUids.length, details: { uids: parsed.quality.duplicateUids } },
      { check_name: "missing_uid", severity: parsed.quality.missingUidCount ? "error" : "info", affected_count: parsed.quality.missingUidCount, details: {} },
      { check_name: "missing_values", severity: parsed.quality.missingValueCount ? "error" : "info", affected_count: parsed.quality.missingValueCount, details: {} },
      { check_name: "invalid_scores", severity: parsed.quality.invalidScoreCount ? "error" : "info", affected_count: parsed.quality.invalidScoreCount, details: {} },
      { check_name: "missing_results", severity: parsed.quality.missingResultCount ? "warning" : "info", affected_count: parsed.quality.missingResultCount, details: { fallback: "Result Not Available" } },
      { check_name: "calculation_mismatches", severity: parsed.quality.calculationMismatchCount ? "warning" : "info", affected_count: parsed.quality.calculationMismatchCount, details: {} },
      { check_name: "generic_review_text", severity: parsed.quality.genericReviewCount ? "warning" : "info", affected_count: parsed.quality.genericReviewCount, details: {} },
    ].map((check) => ({ college_id: collegeId, dataset_id: datasetId, ...check }));
    const { error: qualityError } = await admin.from("data_quality_results").insert(qualityChecks);
    if (qualityError) throw qualityError;

    const { error: readyError } = await admin.from("dataset_versions").update({ import_status: "ready" }).eq("id", datasetId).eq("college_id", collegeId);
    if (readyError) throw readyError;
    const { error: activationError } = await admin.rpc("activate_dataset", { p_college_id: collegeId, p_dataset_id: datasetId });
    if (activationError) throw activationError;
    revalidatePath(collegeDashboardPath(collegeId), "layout");
    return NextResponse.json({ ok: true, datasetId, quality: parsed.quality });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    if (datasetId && collegeId) {
      const admin = createAdminClient();
      await admin.from("dataset_versions").update({ import_status: "failed" }).eq("id", datasetId).eq("college_id", collegeId).eq("is_active", false);
      await admin.from("upload_history").insert({ college_id: collegeId, dataset_id: datasetId, filename: "upload.xlsx", status: "failed", error_message: message });
    }
    if (/^(COLLEGE_|INVALID_COLLEGE|PERSISTENCE_REQUIRED)/.test(message)) return accessErrorResponse(error);
    const status = message === "UNAUTHENTICATED" ? 401 : ["FORBIDDEN", "INVALID_ORIGIN"].includes(message) ? 403 : 400;
    return NextResponse.json({ error: status === 400 ? message : "You are not authorised to import datasets." }, { status });
  }
}

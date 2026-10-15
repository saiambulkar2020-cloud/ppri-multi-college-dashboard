import "server-only";
import demoData from "@/data/demo-data.json";
import { DEFAULT_SETTINGS } from "./constants";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";
import { requireUser } from "./auth";
import type { DashboardBundle, DashboardSettings, DatasetVersion, StudentRecord } from "./types";
import { calculateGrade, calculatePiri } from "./calculations";
import { getCollegeContext } from "./colleges";

function applySettings(student: StudentRecord, settings: DashboardSettings): StudentRecord {
  const sourcePiri = student.piri;
  const sourceGrade = student.grade;
  const recalculatedPiri = calculatePiri(student, settings.weights);
  const recalculatedGrade = calculateGrade(recalculatedPiri, settings.gradeThresholds);
  return {
    ...student,
    piri: recalculatedPiri,
    grade: recalculatedGrade,
    recalculatedPiri,
    recalculatedGrade,
    calculationFlags: {
      ...student.calculationFlags,
      piriMismatch: Math.abs(sourcePiri - recalculatedPiri) > 0.011,
      gradeMismatch: sourceGrade !== recalculatedGrade,
    },
  };
}

export async function getDashboardBundle(collegeId?: string): Promise<DashboardBundle> {
  const current = await requireUser();
  const context = await getCollegeContext(collegeId, current ?? undefined);
  if (!isSupabaseConfigured()) {
    return {
      ...context,
      students: demoData.students as StudentRecord[],
      quality: demoData.quality,
      settings: demoData.settings as DashboardSettings,
      versions: demoData.versions as DatasetVersion[],
      demoMode: true,
      currentUser: current ? { email: current.email, role: current.role } : null,
    };
  }

  if (!current) throw new Error("UNAUTHENTICATED");
  const supabase = await createClient();
  const results = await Promise.all([
    supabase.from("dataset_versions").select("id, validation_summary").eq("college_id", context.college.id).eq("is_active", true).eq("import_status", "ready").maybeSingle(),
    supabase.from("dashboard_settings").select("settings").eq("college_id", context.college.id).maybeSingle(),
  ]);
  if (results.some((result) => result.error)) throw new Error("DASHBOARD_UNAVAILABLE");
  const [{ data: active }, { data: settingsRow }] = results;
  const versions: DatasetVersion[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("dataset_versions").select("id, original_filename, created_at, uploaded_by, total_records, valid_records, is_active, validation_summary").eq("college_id", context.college.id).eq("import_status", "ready").order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) throw new Error("DASHBOARD_UNAVAILABLE");
    versions.push(...(data ?? []).map((version) => ({
      id: version.id, filename: version.original_filename, createdAt: version.created_at,
      uploadedBy: version.uploaded_by ?? "Unknown", totalRecords: version.total_records,
      validRecords: version.valid_records, active: version.is_active, validationSummary: version.validation_summary,
    })));
    if (!data || data.length < 500) break;
  }
  const records: { data: unknown }[] = [];
  if (active) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("student_records").select("data").eq("college_id", context.college.id).eq("dataset_id", active.id).order("id").range(offset, offset + 499);
      if (error) throw new Error("DASHBOARD_UNAVAILABLE");
      records.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
  }

  const settings = (settingsRow?.settings ?? { ...DEFAULT_SETTINGS, instituteName: context.college.name }) as DashboardSettings;
  return {
    ...context,
    students: records.map((row) => applySettings(row.data as StudentRecord, settings)),
    quality: (active?.validation_summary ?? {
      recordsLoaded: 0,
      validRecords: 0,
      validUidCount: 0,
      duplicateUids: [],
      missingUidCount: 0,
      missingValueCount: 0,
      invalidScoreCount: 0,
      missingResultCount: 0,
      calculationMismatchCount: 0,
      genericReviewCount: 0,
      detectedHeaderRow: 0,
      sourceColumnCount: 0,
      importedAt: new Date().toISOString(),
    }) as DashboardBundle["quality"],
    settings,
    versions,
    demoMode: false,
    currentUser: { email: current.email, role: current.role },
  };
}

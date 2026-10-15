import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUploadCollege } from "@/lib/colleges";
import { accessErrorResponse, assertSameOrigin, readLimitedJson } from "@/lib/access-http";
import { collegeDashboardPath } from "@/lib/college-path";

const bodySchema = z.object({ datasetId: z.string().uuid(), collegeId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await requireAdmin();
    const { datasetId, collegeId } = bodySchema.parse(await readLimitedJson(request));
    await requireUploadCollege(collegeId, current);
    const admin = createAdminClient();
    const { data: dataset, error: lookupError } = await admin.from("dataset_versions").select("import_status").eq("college_id", collegeId).eq("id", datasetId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!dataset || dataset.import_status !== "ready") return NextResponse.json({ error: "Only successfully imported datasets can be restored." }, { status: 422 });
    const { error } = await admin.rpc("activate_dataset", { p_college_id: collegeId, p_dataset_id: datasetId });
    if (error) throw error;
    revalidatePath(collegeDashboardPath(collegeId), "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed.";
    if (/^(COLLEGE_|INVALID_COLLEGE|PERSISTENCE_REQUIRED|BODY_TOO_LARGE|INVALID_BODY)/.test(message)) return accessErrorResponse(error);
    const status = message === "UNAUTHENTICATED" ? 401 : ["FORBIDDEN", "INVALID_ORIGIN"].includes(message) ? 403 : 400;
    return NextResponse.json({ error: status === 400 ? message : "You are not authorised to restore datasets." }, { status });
  }
}

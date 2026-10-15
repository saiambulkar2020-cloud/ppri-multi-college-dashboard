import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { settingsSchema } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { requireUploadCollege } from "@/lib/colleges";
import { accessErrorResponse, assertSameOrigin, readLimitedJson } from "@/lib/access-http";
import { collegeDashboardPath } from "@/lib/college-path";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await requireAdmin();
    const { collegeId, settings } = z.object({ collegeId: z.string().uuid(), settings: settingsSchema }).strict().parse(await readLimitedJson(request));
    await requireUploadCollege(collegeId, current);
    const admin = createAdminClient();
    const { error } = await admin.from("dashboard_settings").upsert({ college_id: collegeId, settings, updated_by: current.email, updated_at: new Date().toISOString() });
    if (error) throw error;
    revalidatePath(collegeDashboardPath(collegeId), "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settings could not be saved.";
    if (/^(COLLEGE_|INVALID_COLLEGE|PERSISTENCE_REQUIRED|BODY_TOO_LARGE|INVALID_BODY)/.test(message)) return accessErrorResponse(error);
    const status = message === "UNAUTHENTICATED" ? 401 : ["FORBIDDEN", "INVALID_ORIGIN"].includes(message) ? 403 : 400;
    return NextResponse.json({ error: status === 400 ? message : "You are not authorised to change settings." }, { status });
  }
}

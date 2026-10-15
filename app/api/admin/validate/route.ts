import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPreview } from "@/lib/upload";
import { requireUploadCollege } from "@/lib/colleges";
import { accessErrorResponse, assertSameOrigin } from "@/lib/access-http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await requireAdmin();
    const form = await request.formData();
    const college = await requireUploadCollege(form.get("collegeId"), current);
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an .xlsx workbook." }, { status: 400 });
    return NextResponse.json(await getPreview(file, college.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation failed.";
    if (/^(COLLEGE_|INVALID_COLLEGE|PERSISTENCE_REQUIRED)/.test(message)) return accessErrorResponse(error);
    const status = message === "UNAUTHENTICATED" ? 401 : ["FORBIDDEN", "INVALID_ORIGIN"].includes(message) ? 403 : 400;
    return NextResponse.json({ error: status >= 400 && status < 500 ? message : "Validation failed." }, { status });
  }
}

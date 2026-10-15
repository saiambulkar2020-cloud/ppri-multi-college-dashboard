import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { accessErrorResponse, assertSameOrigin, readLimitedJson } from "@/lib/access-http";
import { getDashboardBundle } from "@/lib/data";
import { createPlacementPdf } from "@/lib/placement-pdf";
import { buildPlacementReport, placementReportFilename } from "@/lib/placement-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reportScopeSchema = z.discriminatedUnion("type", [
  z.object({ collegeId: z.union([z.string().uuid(), z.literal("demo")]), type: z.literal("college") }).strict(),
  z.object({ collegeId: z.union([z.string().uuid(), z.literal("demo")]), type: z.literal("branch"), branch: z.string().max(200) }).strict(),
]);

function reportError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await requireUser();
    if (!current) return reportError("Please sign in to download reports.", 401);
    const input = await readLimitedJson(request, 4096);
    const parsed = reportScopeSchema.safeParse(input);
    if (!parsed.success) return reportError("Choose an overall college report or a valid branch report.", 400);

    const { collegeId, ...scope } = parsed.data;
    const bundle = await getDashboardBundle(collegeId);
    if (scope.type === "branch" && !bundle.students.some((student) => student.branch === scope.branch)) {
      return reportError("The selected branch is not available in the active dataset.", 404);
    }
    if (!bundle.students.length) return reportError("There are no students in the active dataset to report.", 422);

    const report = buildPlacementReport(bundle, scope);
    const pdf = createPlacementPdf(report);
    const filename = placementReportFilename(report);
    const plainFilename = filename.replace(/[^\x20-\x7E]/g, "_");
    const encodedFilename = encodeURIComponent(filename).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return new NextResponse(pdf.output("arraybuffer"), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${plainFilename}"; filename*=UTF-8''${encodedFilename}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}

import { NextResponse } from "next/server";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new Error("INVALID_ORIGIN");
  }
}

export async function readLimitedJson(request: Request, maxBytes = 8192): Promise<unknown> {
  const body = request.body;
  if (!body) throw new Error("INVALID_BODY");
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    await body.cancel().catch(() => undefined);
    throw new Error("BODY_TOO_LARGE");
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("INVALID_BODY");
  }
}

export function accessErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const [status, message] = code === "UNAUTHENTICATED" ? [401, "Please sign in to continue."]
    : code === "FORBIDDEN" ? [403, "An administrator account is required."]
    : code === "INVALID_ORIGIN" ? [403, "This request must come from this website."]
    : code === "INVALID_BODY" ? [400, "The request must contain valid JSON."]
    : code === "BODY_TOO_LARGE" ? [413, "The request is too large. Please reduce its size and try again."]
    : code === "ACCESS_NOT_CONFIGURED" ? [503, "Administrator access has not been configured. Contact the website owner."]
    : code === "COLLEGE_ASSIGNMENT_REQUIRED" ? [403, "Your account has no college assignment. Contact the platform administrator."]
    : code === "COLLEGE_FORBIDDEN" ? [403, "Your account cannot access this college."]
    : code === "COLLEGE_UNAVAILABLE" ? [404, "This college is unavailable or inactive. Contact the platform administrator."]
    : code === "INVALID_COLLEGE" ? [400, "Select a valid college."]
    : code === "PERSISTENCE_REQUIRED" ? [503, "Connect Supabase to enable persistent college uploads."]
    : [500, "The request could not be completed. Please try again."];
  return NextResponse.json({ error: message }, { status: status as number, headers: { "Cache-Control": "no-store" } });
}

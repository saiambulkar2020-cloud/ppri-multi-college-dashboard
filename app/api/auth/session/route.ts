import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { hasAccessSession } from "@/lib/access-session";
import { accessErrorResponse } from "@/lib/access-http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await requireUser();
    const protectedAccess = !!current && current.role === "admin" && await hasAccessSession(current.subject);
    return NextResponse.json({ user: current ? { email: current.email, role: current.role } : null, protectedAccess }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ user: null, protectedAccess: false }, { headers: { "Cache-Control": "no-store" } });
    }
    return accessErrorResponse(error);
  }
}

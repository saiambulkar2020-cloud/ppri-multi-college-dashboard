import { NextResponse } from "next/server";
import { z } from "zod";
import { accessIdentityMatches, safeLoginDestination, verifyAccessPassword } from "@/lib/access-crypto";
import { accessSessionConfigured, clearAccessSession, issueAccessSession, localAccessConfig } from "@/lib/access-session";
import { accessErrorResponse, assertSameOrigin, readLimitedJson } from "@/lib/access-http";
import { clearSuccessfulLoginAttempts, reserveLoginAttempt } from "@/lib/access-throttle";
import { requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { resolveLoginEmail } from "@/lib/login-identity";

export const runtime = "nodejs";
const schema = z.object({ id: z.string().trim().min(1).max(254), password: z.string().min(1).max(1024), next: z.string().max(1024).optional() }).strict();
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await readLimitedJson(request));
    if (!parsed.success) return NextResponse.json({ error: "Enter your username or email and password." }, { status: 400, headers });
    const { id, password } = parsed.data;
    const next = safeLoginDestination(parsed.data.next);
    const retryAfter = reserveLoginAttempt(id);
    if (retryAfter) return NextResponse.json({ error: "Too many sign-in attempts. Please wait before trying again." }, { status: 429, headers: { ...headers, "Retry-After": String(retryAfter) } });
    await clearAccessSession();
    if (!isSupabaseConfigured()) {
      const config = localAccessConfig();
      if (!config) throw new Error("ACCESS_NOT_CONFIGURED");
      // Always derive the password key, even for an unknown ID.
      const passwordValid = await verifyAccessPassword(password, config.passwordHash);
      if (!passwordValid || !accessIdentityMatches(id, config.id)) {
        return NextResponse.json({ error: "The ID or password is incorrect." }, { status: 401, headers });
      }
      await issueAccessSession(config.subject);
    } else {
      const supabase = await createClient();
      const email = await resolveLoginEmail(id);
      const { error } = await supabase.auth.signInWithPassword({ email: email ?? "invalid-login@example.invalid", password });
      if (!email && !error) await supabase.auth.signOut();
      if (error || !email) return NextResponse.json({ error: "The ID or password is incorrect." }, { status: 401, headers });
      const current = await requireUser();
      if (!current) throw new Error("UNAUTHENTICATED");
      if (current.role === "admin") {
        if (!accessSessionConfigured()) throw new Error("ACCESS_NOT_CONFIGURED");
        await issueAccessSession(current.subject);
      } else if (next.endsWith("/admin")) {
        throw new Error("FORBIDDEN");
      }
    }
    clearSuccessfulLoginAttempts(id);
    return NextResponse.json({ ok: true, next }, { headers });
  } catch (error) {
    return accessErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { clearAccessSession } from "@/lib/access-session";
import { accessErrorResponse, assertSameOrigin } from "@/lib/access-http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await clearAccessSession();
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      await supabase.auth.signOut();
    }
    const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return accessErrorResponse(error);
  }
}

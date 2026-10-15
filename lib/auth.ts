import "server-only";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";
import { hasAccessSession, localAccessConfig } from "./access-session";

export async function requireUser() {
  if (!isSupabaseConfigured()) {
    const config = localAccessConfig();
    if (!config || !await hasAccessSession(config.subject)) return null;
    return { email: config.id, role: "admin" as const, subject: config.subject, collegeId: null, username: config.id };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("UNAUTHENTICATED");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role, college_id, username").eq("id", data.user.id).maybeSingle();
  if (profileError) throw new Error("PROFILE_UNAVAILABLE");
  const email = data.user.email?.toLowerCase() ?? "";
  const role = profile?.role === "admin" ? "admin" : "viewer";
  return { email, role, subject: `supabase:${data.user.id}`, collegeId: (profile?.college_id ?? null) as string | null, username: (profile?.username ?? null) as string | null } as const;
}

export type DashboardUser = NonNullable<Awaited<ReturnType<typeof requireUser>>>;

export async function requireAdmin() {
  const current = await requireUser();
  if (!current) throw new Error("UNAUTHENTICATED");
  if (current.role !== "admin") throw new Error("FORBIDDEN");
  if (!await hasAccessSession(current.subject)) throw new Error("UNAUTHENTICATED");
  return current;
}

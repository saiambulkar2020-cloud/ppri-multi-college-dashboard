import "server-only";
import { createAdminClient } from "./supabase/admin";

// Username aliases never grant membership. They resolve to a real Auth account;
// its current protected profile determines college access after authentication.
export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const normalized = identifier.trim().toLowerCase();
  if (normalized.includes("@")) return normalized;
  if (!/^[a-z0-9][a-z0-9._-]{1,84}$/.test(normalized)) return null;
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from("profiles").select("id").eq("username", normalized).maybeSingle();
  if (error) throw new Error("PROFILE_UNAVAILABLE");
  if (!profile) return null;
  const { data, error: userError } = await admin.auth.admin.getUserById(profile.id);
  if (userError || !data.user?.email) return null;
  return data.user.email;
}

import "server-only";
import { cookies } from "next/headers";
import { ACCESS_SESSION_SECONDS, isAccessPasswordHash, localAccessSubject, signAccessSession, verifyAccessSession } from "./access-crypto";
import { isSupabaseConfigured } from "./supabase/config";

const cookieName = process.env.NODE_ENV === "production" ? "__Host-ppri_admin_access" : "ppri_admin_access";
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export function accessSessionConfigured() {
  return (process.env.ACCESS_SESSION_SECRET?.length ?? 0) >= 32;
}

export function localAccessConfig() {
  // Local credentials must never provide a back door into a configured college database.
  if (isSupabaseConfigured()) return null;
  const id = process.env.ACCESS_ADMIN_ID?.trim();
  const passwordHash = process.env.ACCESS_ADMIN_PASSWORD_HASH ?? "";
  if (!id || !isAccessPasswordHash(passwordHash) || !accessSessionConfigured()) return null;
  return { id, passwordHash, subject: localAccessSubject(id, passwordHash) };
}

export async function hasAccessSession(subject: string) {
  const jar = await cookies();
  return verifyAccessSession(jar.get(cookieName)?.value, subject, process.env.ACCESS_SESSION_SECRET ?? "");
}

export async function issueAccessSession(subject: string) {
  const token = signAccessSession(subject, process.env.ACCESS_SESSION_SECRET ?? "");
  (await cookies()).set(cookieName, token, { ...cookieOptions, maxAge: ACCESS_SESSION_SECONDS });
}

export async function clearAccessSession() {
  (await cookies()).set(cookieName, "", { ...cookieOptions, maxAge: 0 });
}

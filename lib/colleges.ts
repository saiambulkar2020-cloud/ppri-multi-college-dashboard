import "server-only";
import { z } from "zod";
import { requireUser, type DashboardUser } from "./auth";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";
import type { College } from "./types";

export const DEMO_COLLEGE: College = { id: "demo", code: "DEMO", name: "Sample college" };
export const collegeIdSchema = z.string().uuid();

export async function getCollegeContext(requestedId?: string, user?: DashboardUser) {
  if (!isSupabaseConfigured()) {
    if (requestedId && requestedId !== "demo") throw new Error("COLLEGE_UNAVAILABLE");
    return { college: DEMO_COLLEGE, colleges: [DEMO_COLLEGE] };
  }
  const current = user ?? await requireUser();
  if (!current) throw new Error("UNAUTHENTICATED");
  if (current.role !== "admin") {
    if (!current.collegeId) throw new Error("COLLEGE_ASSIGNMENT_REQUIRED");
    if (requestedId && requestedId !== current.collegeId) throw new Error("COLLEGE_FORBIDDEN");
  }
  if (requestedId && !collegeIdSchema.safeParse(requestedId).success) throw new Error("COLLEGE_UNAVAILABLE");
  const client = await createClient();
  const colleges: College[] = [];
  // Paginate to avoid silently truncating the administrator's college list.
  for (let offset = 0; ; offset += 500) {
    let query = client.from("colleges").select("id, code, name").eq("is_active", true).order("code").range(offset, offset + 499);
    if (current.role !== "admin") query = query.eq("id", current.collegeId!);
    const { data, error } = await query;
    if (error) throw new Error("COLLEGES_UNAVAILABLE");
    colleges.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const id = requestedId ?? (current.role === "admin" ? colleges[0]?.id : current.collegeId);
  const college = colleges.find((item) => item.id === id);
  if (!college) throw new Error("COLLEGE_UNAVAILABLE");
  return { college, colleges };
}

export async function requireUploadCollege(value: unknown, user: DashboardUser) {
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  if (!isSupabaseConfigured()) throw new Error("PERSISTENCE_REQUIRED");
  const parsed = collegeIdSchema.safeParse(value);
  if (!parsed.success) throw new Error("INVALID_COLLEGE");
  return (await getCollegeContext(parsed.data, user)).college;
}

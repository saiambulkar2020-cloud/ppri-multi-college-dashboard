import "server-only";
import { redirect } from "next/navigation";
import { getCollegeContext } from "./colleges";
import { collegeDashboardPath } from "./college-path";

export async function redirectToCollege(suffix = "") {
  const { college } = await getCollegeContext();
  redirect(`${collegeDashboardPath(college.id)}${suffix}`);
}

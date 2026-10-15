import { redirect } from "next/navigation";
import { getCollegeContext } from "@/lib/colleges";
import { CollegeAccessMessage } from "@/components/college-access-message";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    await getCollegeContext();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof Error && ["COLLEGE_ASSIGNMENT_REQUIRED", "COLLEGE_UNAVAILABLE"].includes(error.message)) return <CollegeAccessMessage code={error.message} />;
    throw error;
  }
  return children;
}

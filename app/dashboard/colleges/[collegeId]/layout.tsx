import { redirect } from "next/navigation";
import { DashboardProvider } from "@/components/dashboard-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { CollegeAccessMessage } from "@/components/college-access-message";
import { getDashboardBundle } from "@/lib/data";
import { collegeDashboardPath } from "@/lib/college-path";

export default async function CollegeLayout({ children, params }: { children: React.ReactNode; params: Promise<{ collegeId: string }> }) {
  const { collegeId } = await params;
  let bundle;
  try {
    bundle = await getDashboardBundle(collegeId);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect(`/login?next=${encodeURIComponent(collegeDashboardPath(collegeId))}`);
    if (error instanceof Error && ["COLLEGE_FORBIDDEN", "COLLEGE_UNAVAILABLE", "COLLEGE_ASSIGNMENT_REQUIRED"].includes(error.message)) return <CollegeAccessMessage code={error.message} />;
    throw error;
  }
  // A college or dataset change remounts all filters, upload previews and report state.
  const key = `${collegeId}:${bundle.versions.find((version) => version.active)?.id ?? "empty"}:${JSON.stringify(bundle.settings)}`;
  return <DashboardProvider key={key} bundle={bundle}><DashboardShell>{children}</DashboardShell></DashboardProvider>;
}

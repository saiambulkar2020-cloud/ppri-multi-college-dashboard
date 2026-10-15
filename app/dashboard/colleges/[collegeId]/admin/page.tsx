import { redirect } from "next/navigation";
import { AdminPage } from "@/components/admin-page";
import { requireAdmin } from "@/lib/auth";
import { collegeDashboardPath } from "@/lib/college-path";

export const metadata = { title: "Platform Administration" };
export default async function Page({ params }: { params: Promise<{ collegeId: string }> }) {
  const { collegeId } = await params;
  try { await requireAdmin(); }
  catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect(`/login?next=${encodeURIComponent(`${collegeDashboardPath(collegeId)}/admin`)}`);
    if (error instanceof Error && error.message === "FORBIDDEN") redirect(collegeDashboardPath(collegeId));
    throw error;
  }
  return <AdminPage />;
}

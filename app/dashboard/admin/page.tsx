import { redirect } from "next/navigation";
import { redirectToCollege } from "@/lib/dashboard-redirect";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Admin & Settings" };
export default async function AdminRoute() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") redirect("/dashboard");
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      redirect("/login?next=%2Fdashboard%2Fadmin");
    }
    throw error;
  }
  return redirectToCollege("/admin");
}

import { redirectToCollege } from "@/lib/dashboard-redirect";
export default async function Page({ searchParams }: { searchParams: Promise<{ report?: string }> }) {
  const { report } = await searchParams;
  return redirectToCollege(report === "1" ? "?report=1" : "");
}

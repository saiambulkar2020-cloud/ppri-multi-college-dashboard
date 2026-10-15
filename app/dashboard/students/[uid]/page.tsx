import { redirectToCollege } from "@/lib/dashboard-redirect";

export const metadata = { title: "Student Profile" };
export default async function StudentProfileRoute({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return redirectToCollege(`/students/${encodeURIComponent(uid)}`);
}

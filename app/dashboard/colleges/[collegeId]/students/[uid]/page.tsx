import { StudentProfilePage } from "@/components/student-profile-page";
import { formatDate } from "@/lib/format";
export const metadata = { title: "Student Profile" };
export default async function Page({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return <StudentProfilePage uid={uid} reportDate={formatDate(new Date(), { month: "long" })} />;
}

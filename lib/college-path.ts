export function collegeDashboardPath(collegeId: string) {
  return `/dashboard/colleges/${encodeURIComponent(collegeId)}`;
}

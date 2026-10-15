export interface VersionState { id: string; collegeId: string; active: boolean; status: "importing" | "ready" | "failed"; recordCount: number }

export function activateVersion(versions: VersionState[], collegeId: string, datasetId: string): VersionState[] {
  const target = versions.find((version) => version.id === datasetId && version.collegeId === collegeId);
  if (!target || target.status !== "ready" || target.recordCount <= 0) throw new Error("Only a complete, ready dataset can be activated.");
  return versions.map((version) => version.collegeId === collegeId ? { ...version, active: version.id === datasetId } : version);
}

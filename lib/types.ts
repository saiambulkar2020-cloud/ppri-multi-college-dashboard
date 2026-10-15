export type Grade = "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F";

export type CompetencyKey =
  | "communicationSkill"
  | "teamworkLeadership"
  | "ethicalConduct"
  | "workplaceEtiquette"
  | "emotionalIntelligence"
  | "stressHandling"
  | "stressTolerance"
  | "adaptability"
  | "coreSubjectKnowledge"
  | "appliedProblemSolving"
  | "toolProficiency"
  | "projectEvaluation"
  | "externalProjectDevelopment"
  | "internshipExperience"
  | "programmingSkills"
  | "corporateCulture";

export type GroupKey = "hr" | "psychological" | "technical" | "industry";

export interface StudentRecord {
  uid: string;
  batch: string;
  name: string;
  semester: string;
  branch: string;
  section: string;
  aptitude: number;
  coding: number;
  competencies: Record<CompetencyKey, number>;
  groupTotals: Record<GroupKey, number>;
  totalPiriScore: number;
  recalculatedTotalPiriScore: number;
  piri: number;
  recalculatedPiri: number;
  grade: Grade;
  recalculatedGrade: Grade;
  estimatedPackage: string;
  result: string | null;
  remark: string;
  review: string;
  calculationFlags: {
    totalMismatch: boolean;
    piriMismatch: boolean;
    gradeMismatch: boolean;
  };
}

export interface DataQualitySummary {
  recordsLoaded: number;
  validRecords: number;
  validUidCount: number;
  duplicateUids: string[];
  missingUidCount: number;
  missingValueCount: number;
  invalidScoreCount: number;
  missingResultCount: number;
  calculationMismatchCount: number;
  genericReviewCount: number;
  detectedHeaderRow: number;
  sourceColumnCount: number;
  importedAt: string;
}

export interface DatasetVersion {
  id: string;
  filename: string;
  createdAt: string;
  uploadedBy: string;
  totalRecords: number;
  validRecords: number;
  active: boolean;
  validationSummary: DataQualitySummary;
}

export interface DashboardSettings {
  dashboardTitle: string;
  instituteName: string;
  instituteLogo: string;
  primaryColor: string;
  accentColor: string;
  weights: Record<"aptitude" | "coding" | GroupKey, number>;
  gradeThresholds: Record<Exclude<Grade, "F">, number>;
  supportPriorityThreshold: number;
  recordsPerPage: number;
  footerText: string;
}

export interface DashboardBundle {
  college: College;
  colleges: College[];
  students: StudentRecord[];
  quality: DataQualitySummary;
  settings: DashboardSettings;
  versions: DatasetVersion[];
  demoMode: boolean;
  currentUser: { email: string; role: "admin" | "viewer" } | null;
}

export interface College {
  id: string;
  code: string;
  name: string;
}

export interface DashboardFilters {
  batch: string;
  semester: string;
  branch: string;
  section: string;
  grade: string;
  estimatedPackage: string;
}

export interface ParsedWorkbook {
  records: StudentRecord[];
  quality: DataQualitySummary;
  columnMapping: Array<{ original: string; cleaned: string; column: number }>;
  warnings: string[];
  canActivate: boolean;
}

import type { CompetencyKey, DashboardSettings, GroupKey } from "./types";

export const COMPETENCY_GROUPS: Array<{
  key: GroupKey;
  label: string;
  competencies: Array<{ key: CompetencyKey; label: string }>;
}> = [
  {
    key: "hr",
    label: "HR & Professional Qualities",
    competencies: [
      { key: "communicationSkill", label: "Communication Skill" },
      { key: "teamworkLeadership", label: "Teamwork & Leadership" },
      { key: "ethicalConduct", label: "Ethical Values & Professional Conduct" },
      { key: "workplaceEtiquette", label: "Workplace Etiquette & Presentation" },
    ],
  },
  {
    key: "psychological",
    label: "Psychological & Behavioural Readiness",
    competencies: [
      { key: "emotionalIntelligence", label: "Emotional Intelligence" },
      { key: "stressHandling", label: "Stress Handling & Resilience" },
      { key: "stressTolerance", label: "Stress Tolerance" },
      { key: "adaptability", label: "Adaptability & Growth Mindset" },
    ],
  },
  {
    key: "technical",
    label: "Technical Interview",
    competencies: [
      { key: "coreSubjectKnowledge", label: "Core Subject Knowledge" },
      { key: "appliedProblemSolving", label: "Applied Problem Solving" },
      { key: "toolProficiency", label: "Tool Proficiency" },
      { key: "projectEvaluation", label: "Project / Mini Project Evaluation" },
    ],
  },
  {
    key: "industry",
    label: "Industry Awareness & Application Skills",
    competencies: [
      { key: "externalProjectDevelopment", label: "External Project Development" },
      { key: "internshipExperience", label: "Internship / Experience" },
      { key: "programmingSkills", label: "Programming / Software / Design Knowledge" },
      { key: "corporateCulture", label: "Corporate Culture Awareness" },
    ],
  },
];

export const ALL_COMPETENCIES = COMPETENCY_GROUPS.flatMap((group) =>
  group.competencies.map((competency) => ({ ...competency, group: group.key, groupLabel: group.label })),
);

export const DEFAULT_SETTINGS: DashboardSettings = {
  dashboardTitle: "PPRI / PIRI Placement Readiness Dashboard",
  instituteName: "YCCE Career Readiness Team",
  instituteLogo: "",
  primaryColor: "#0B1F3A",
  accentColor: "#0EA5A8",
  weights: {
    aptitude: 0.2,
    coding: 0.25,
    hr: 0.15,
    psychological: 0.15,
    technical: 0.15,
    industry: 0.1,
  },
  gradeThresholds: { "A+": 9.5, A: 9, "B+": 8.5, B: 8, "C+": 7.5, C: 7, D: 6 },
  supportPriorityThreshold: 7,
  recordsPerPage: 10,
  footerText: "Confidential — for authorised placement-readiness use only.",
};

export const COLUMN_MAPPING_DISPLAY = [
  ["First TOTAL HR SCORE", "HR & Professional Qualities Total"],
  ["Second TOTAL HR SCORE", "Psychological & Behavioural Readiness Total"],
  ["Third TOTAL HR SCORE", "Technical Interview Total"],
  ["TOTAL TECHNICAL SCORE", "Industry Awareness & Application Skills Total"],
  ["STRESS TOLERENCE", "Stress Tolerance"],
  ["ADAPT0ILITY & GROWTH MINDSET", "Adaptability & Growth Mindset"],
  ["PPRI GRADES", "PPRI Grade"],
] as const;

export const GRADE_ORDER = ["A+", "A", "B+", "B", "C+", "C", "D", "F"] as const;
export const CHART_COLORS = ["#0EA5A8", "#1D4ED8", "#D9A521", "#16A34A", "#7C3AED", "#EA580C", "#DC2626", "#64748B"];

import { describe, expect, it } from "vitest";
import { calculateGrade, calculatePiri, calculateTotalPiriScore, competencyExtremes } from "../lib/calculations";
import type { CompetencyKey, StudentRecord } from "../lib/types";

const base = { aptitude: 86, coding: 61, groupTotals: { hr: 15, psychological: 12, technical: 14, industry: 9 } } as Pick<StudentRecord, "aptitude" | "coding" | "groupTotals">;

describe("PIRI calculations", () => {
  it("calculates Total PIRI Score", () => expect(calculateTotalPiriScore(base)).toBe(197));
  it("calculates the weighted PIRI and rounds to two decimals", () => expect(calculatePiri(base)).toBe(7.9));
  it.each([[9.5, "A+"], [9, "A"], [8.5, "B+"], [8, "B"], [7.5, "C+"], [7, "C"], [6, "D"], [5.99, "F"]])("assigns grade for %s", (score, grade) => expect(calculateGrade(score as number)).toBe(grade));
  it("identifies strongest and weakest competency", () => {
    const values = Object.fromEntries([
      "communicationSkill", "teamworkLeadership", "ethicalConduct", "workplaceEtiquette", "emotionalIntelligence", "stressHandling", "stressTolerance", "adaptability", "coreSubjectKnowledge", "appliedProblemSolving", "toolProficiency", "projectEvaluation", "externalProjectDevelopment", "internshipExperience", "programmingSkills", "corporateCulture",
    ].map((key, index) => [key, index === 0 ? 5 : index === 15 ? 1 : 3])) as Record<CompetencyKey, number>;
    const extremes = competencyExtremes(values);
    expect(extremes.strongest.label).toBe("Communication Skill");
    expect(extremes.weakest.label).toBe("Corporate Culture Awareness");
  });
});

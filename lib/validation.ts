import { z } from "zod";
import { DEFAULT_SETTINGS } from "./constants";

export const studentInputSchema = z.object({
  uid: z.string().trim().min(1),
  name: z.string().trim().min(1),
  batch: z.string().trim(),
  semester: z.string().trim(),
  branch: z.string().trim(),
  section: z.string().trim(),
  aptitude: z.number().min(0).max(100),
  coding: z.number().min(0).max(100),
});

export const settingsSchema = z
  .object({
    dashboardTitle: z.string().trim().min(3).max(100),
    instituteName: z.string().trim().min(2).max(120),
    instituteLogo: z.union([z.literal(""), z.string().url()]),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    weights: z.object({
      aptitude: z.number().min(0).max(1),
      coding: z.number().min(0).max(1),
      hr: z.number().min(0).max(1),
      psychological: z.number().min(0).max(1),
      technical: z.number().min(0).max(1),
      industry: z.number().min(0).max(1),
    }),
    gradeThresholds: z.object({
      "A+": z.number().min(0).max(10),
      A: z.number().min(0).max(10),
      "B+": z.number().min(0).max(10),
      B: z.number().min(0).max(10),
      "C+": z.number().min(0).max(10),
      C: z.number().min(0).max(10),
      D: z.number().min(0).max(10),
    }),
    supportPriorityThreshold: z.number().min(0).max(10),
    recordsPerPage: z.number().int().min(5).max(100),
    footerText: z.string().max(240),
  })
  .superRefine((settings, context) => {
    const total = Object.values(settings.weights).reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 1) > 0.0001) {
      context.addIssue({ code: "custom", path: ["weights"], message: "PIRI weights must total 100%." });
    }
  });

export const defaultSettings = settingsSchema.parse(DEFAULT_SETTINGS);

export function detectDuplicateUids(uids: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const uid of uids.filter(Boolean)) {
    if (seen.has(uid)) duplicates.add(uid);
    seen.add(uid);
  }
  return [...duplicates];
}

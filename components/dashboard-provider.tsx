"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { filterStudents } from "@/lib/analytics";
import type { DashboardBundle, DashboardFilters } from "@/lib/types";
import { collegeDashboardPath } from "@/lib/college-path";

const EMPTY_FILTERS: DashboardFilters = { batch: "", semester: "", branch: "", section: "", grade: "", estimatedPackage: "" };

type DashboardContextValue = DashboardBundle & {
  basePath: string;
  filters: DashboardFilters;
  setFilter: (key: keyof DashboardFilters, value: string) => void;
  clearFilters: () => void;
  filteredStudents: DashboardBundle["students"];
  filterCount: number;
  options: Record<keyof DashboardFilters, string[]>;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ bundle, children }: { bundle: DashboardBundle; children: React.ReactNode }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const filteredStudents = useMemo(() => filterStudents(bundle.students, filters), [bundle.students, filters]);
  const options = useMemo(() => ({
    batch: [...new Set(bundle.students.map((student) => student.batch))].sort(),
    semester: [...new Set(bundle.students.map((student) => student.semester))].sort(),
    branch: [...new Set(bundle.students.map((student) => student.branch))].sort(),
    section: [...new Set(bundle.students.map((student) => student.section))].sort(),
    grade: [...new Set(bundle.students.map((student) => student.grade))].sort(),
    estimatedPackage: [...new Set(bundle.students.map((student) => student.estimatedPackage))].sort(),
  }), [bundle.students]);
  const value = {
    ...bundle,
    basePath: collegeDashboardPath(bundle.college.id),
    filters,
    setFilter: (key: keyof DashboardFilters, value: string) => setFilters((current) => ({ ...current, [key]: value })),
    clearFilters: () => setFilters(EMPTY_FILTERS),
    filteredStudents,
    filterCount: Object.values(filters).filter(Boolean).length,
    options,
  };

  return (
    <DashboardContext.Provider value={value}>
      <div style={{ "--primary": bundle.settings.primaryColor, "--accent": bundle.settings.accentColor } as React.CSSProperties}>{children}</div>
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard must be used inside DashboardProvider");
  return context;
}

"use client";

import { X, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useDashboard } from "./dashboard-provider";
import type { DashboardFilters } from "@/lib/types";

const labels: Record<keyof DashboardFilters, string> = { batch: "Batch", semester: "Semester", branch: "Branch", section: "Section", grade: "Grade", estimatedPackage: "Estimated Package" };

export function FilterDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { filters, options, setFilter, clearFilters, filterCount, filteredStudents, students } = useDashboard();
  return (
    <>
      {open ? <button aria-label="Close filters" className="drawer-backdrop" onClick={onClose} /> : null}
      <aside aria-hidden={!open} aria-label="Global filters" className={`filter-drawer ${open ? "is-open" : ""}`}>
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div><p className="eyebrow">GLOBAL VIEW</p><h2 className="mt-1 text-xl font-bold text-navy">Filters</h2></div>
          <button aria-label="Close filters" className="icon-button" onClick={onClose}><X /></button>
        </div>
        <div className="mt-5 space-y-4">
          {(Object.keys(labels) as Array<keyof DashboardFilters>).map((key) => (
            <label className="field-label" key={key}><span>{labels[key]}</span><select value={filters[key]} onChange={(event) => setFilter(key, event.target.value)}><option value="">All {labels[key]}</option>{options[key].map((option) => <option key={option}>{option}</option>)}</select></label>
          ))}
        </div>
        <div className="mt-auto border-t border-slate-200 pt-5">
          <p className="mb-3 text-sm text-slate-600">Showing <strong>{filteredStudents.length}</strong> of {students.length} students</p>
          <button className="btn-secondary w-full" disabled={!filterCount} onClick={clearFilters}><RotateCcw /> Clear all filters</button>
        </div>
      </aside>
    </>
  );
}

export function FilterButton({ onClick }: { onClick: () => void }) {
  const { filterCount } = useDashboard();
  return <button className="btn-secondary" onClick={onClick}><SlidersHorizontal /> Filters {filterCount ? <span className="count-badge">{filterCount}</span> : null}</button>;
}

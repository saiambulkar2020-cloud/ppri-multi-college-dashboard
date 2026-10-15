"use client";

import { useState } from "react";
import { Trophy, TriangleAlert } from "lucide-react";
import { gradeDistribution, groupSummary, packageDistribution } from "@/lib/analytics";
import { useDashboard } from "./dashboard-provider";
import { Card, EmptyState, KpiCard, PageHeader, ScorePill } from "./ui";
import { DistributionChart, DonutChart, HorizontalRankChart } from "./charts";

export function ComparisonPage() {
  const { filteredStudents: students } = useDashboard();
  const [mode, setMode] = useState<"branch" | "section">("branch");
  if (!students.length) return <><PageHeader eyebrow="GROUP COMPARISON" title="Branch and section comparison" description="Rank groups and compare performance." /><EmptyState /></>;
  const summary = groupSummary(students, mode);
  const best = summary[0];
  const support = summary.at(-1)!;
  return (
    <div className="page-stack">
      <PageHeader eyebrow="GROUP COMPARISON" title="Branch and section comparison" description="Compare student count, PIRI, aptitude, coding, grades and package bands across groups." actions={<div className="segmented"><button className={mode === "branch" ? "active" : ""} onClick={() => setMode("branch")}>Branches</button><button className={mode === "section" ? "active" : ""} onClick={() => setMode("section")}>Sections</button></div>} />
      <div className="kpi-grid four">
        <KpiCard label={`Total ${mode}s`} value={summary.length} note={`${students.length} students compared`} />
        <KpiCard label="Best-performing group" value={best.name} note={`Average PIRI ${best.piri.toFixed(2)}`} tone="positive" />
        <KpiCard label="Priority support group" value={support.name} note={`Average PIRI ${support.piri.toFixed(2)}`} tone="warning" />
        <KpiCard label="Performance spread" value={(best.piri - support.piri).toFixed(2)} note="PIRI points between highest and lowest" />
      </div>
      <div className="grid-2">
        <Card title={`${mode === "branch" ? "Branch" : "Section"} ranking`} subtitle="Average PIRI, highest first"><HorizontalRankChart data={summary.map((item) => ({ name: item.name, value: item.piri }))} /></Card>
        <Card title="Overall grade distribution" subtitle="Current filtered student population"><DistributionChart data={gradeDistribution(students)} /></Card>
      </div>
      <div className="grid-2">
        <Card title="Estimated package mix" subtitle="Across the selected comparison"><DonutChart data={packageDistribution(students)} /></Card>
        <Card title="Highlights" subtitle="Best group and priority-support group"><div className="highlight-pair"><article className="highlight-good"><Trophy /><span>Best-performing</span><strong>{best.name}</strong><p>{best.count} students · Aptitude {best.aptitude.toFixed(1)} · Coding {best.coding.toFixed(1)}</p></article><article className="highlight-warning"><TriangleAlert /><span>Most support needed</span><strong>{support.name}</strong><p>{support.count} students · Aptitude {support.aptitude.toFixed(1)} · Coding {support.coding.toFixed(1)}</p></article></div></Card>
      </div>
      <Card title="Conditional comparison table" subtitle="Colour cues highlight relative PIRI performance">
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Rank</th><th>{mode === "branch" ? "Branch" : "Section"}</th><th>Students</th><th>Average PIRI</th><th>Average Aptitude</th><th>Average Coding</th><th>Top grade count</th><th>Top package band</th></tr></thead><tbody>{summary.map((item, index) => { const topPackage = Object.entries(item.packages).sort((a, b) => b[1] - a[1])[0]; return <tr key={item.name}><td>{index + 1}</td><th>{item.name}</th><td>{item.count}</td><td><ScorePill value={item.piri} /></td><td>{item.aptitude.toFixed(1)}</td><td>{item.coding.toFixed(1)}</td><td>{(item.grades["A+"] ?? 0) + (item.grades.A ?? 0)}</td><td>{topPackage?.[0] ?? "—"}</td></tr>; })}</tbody></table></div>
      </Card>
    </div>
  );
}

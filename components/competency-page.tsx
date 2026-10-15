"use client";

import { ALL_COMPETENCIES, COMPETENCY_GROUPS } from "@/lib/constants";
import { average, competencyAverages, competencyHeatmap, groupCompetencyExtremes } from "@/lib/analytics";
import { useDashboard } from "./dashboard-provider";
import { Card, EmptyState, KpiCard, PageHeader } from "./ui";
import { HorizontalRankChart } from "./charts";

function Heatmap({ by }: { by: "branch" | "section" }) {
  const { filteredStudents } = useDashboard();
  const rows = competencyHeatmap(filteredStudents, by);
  return <div className="table-scroll"><table className="heatmap-table"><thead><tr><th>{by === "branch" ? "Branch" : "Section"}</th>{ALL_COMPETENCIES.map((item) => <th title={item.label} key={item.key}>{item.label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.name}><th>{row.name}</th>{ALL_COMPETENCIES.map((item) => { const score = row.values[item.key]; const lightness = Math.max(28, 92 - score * 12); return <td key={item.key} style={{ backgroundColor: `hsl(178 70% ${lightness}%)`, color: score >= 3.5 ? "white" : "#0f172a" }} title={`${item.label}: ${score.toFixed(2)}`}>{score.toFixed(2)}</td>; })}</tr>)}</tbody></table></div>;
}

export function CompetencyPage() {
  const { filteredStudents: students, settings } = useDashboard();
  if (!students.length) return <><PageHeader eyebrow="COMPETENCY ANALYSIS" title="Skills and readiness signals" description="Compare all competency groups and individual skills." /><EmptyState /></>;
  const competencies = competencyAverages(students);
  const branchExtremes = groupCompetencyExtremes(students, "branch");
  const branchGroups = [...new Set(students.map((student) => student.branch))].sort();
  const sectionGroups = [...new Set(students.map((student) => student.section))].sort();
  return (
    <div className="page-stack">
      <PageHeader eyebrow="COMPETENCY ANALYSIS" title="Skills and readiness signals" description="See institution-wide strengths, development gaps, and variation across branches and sections." />
      <div className="kpi-grid four">
        {COMPETENCY_GROUPS.map((group) => {
          const score = average(students.map((student) => student.groupTotals[group.key] / 4));
          return <KpiCard key={group.key} label={group.label} value={score.toFixed(2)} note={`Average out of 5 · gap ${(5 - score).toFixed(2)}`} tone={score >= 3.5 ? "positive" : "warning"} />;
        })}
      </div>
      <Card title="All 16 competencies ranked" subtitle="Average score and gap from the maximum score of 5"><HorizontalRankChart data={competencies.map((item) => ({ name: item.label, value: item.average }))} max={5} color={settings.accentColor} /></Card>
      <Card title="Competency heatmap by branch" subtitle="Darker cells indicate stronger averages"><Heatmap by="branch" /></Card>
      <Card title="Competency heatmap by section" subtitle="Use global filters to compare a smaller selection"><Heatmap by="section" /></Card>
      <div className="grid-2">
        <Card title="Strongest and weakest by branch" subtitle="Fast training-priority view"><div className="comparison-cards">{branchExtremes.map((item) => <article key={item.name}><div><strong>{item.name}</strong><small>Branch</small></div><p className="strength"><span>Strongest</span>{item.strongest.label}<b>{item.strongest.average.toFixed(2)}</b></p><p className="improvement"><span>Weakest</span>{item.weakest.label}<b>{item.weakest.average.toFixed(2)}</b></p></article>)}</div></Card>
        <Card title="Coverage in the current view" subtitle="Groups available for comparison"><div className="coverage-panel"><div><strong>{branchGroups.length}</strong><span>Branches</span><p>{branchGroups.join(" · ")}</p></div><div><strong>{sectionGroups.length}</strong><span>Sections</span><p>{sectionGroups.join(" · ")}</p></div><div><strong>{students.length}</strong><span>Students</span><p>Every competency average uses the same active global filters.</p></div></div></Card>
      </div>
    </div>
  );
}

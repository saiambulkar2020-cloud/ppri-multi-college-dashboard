"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS } from "@/lib/constants";

const tooltipStyle = { borderRadius: 12, border: "1px solid #dbe3ee", boxShadow: "0 10px 30px rgba(15,23,42,.12)", fontSize: 12 };

export function DistributionChart({ data, color = "#0EA5A8", onSelect }: { data: Array<{ name: string; value: number }>; color?: string; onSelect?: (name: string) => void }) {
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 10, right: 8, left: -24, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" fill={color} radius={[7, 7, 0, 0]}>{data.map((entry) => <Cell cursor={onSelect ? "pointer" : "default"} fill={color} key={entry.name} onClick={() => onSelect?.(entry.name)} />)}</Bar></BarChart></ResponsiveContainer></div>;
}

export function HorizontalRankChart({ data, max = 10, color = "#0EA5A8", valueKey = "value", onSelect }: { data: Array<Record<string, string | number>>; max?: number; color?: string; valueKey?: string; onSelect?: (name: string) => void }) {
  const height = Math.max(270, data.length * 34);
  return <div className="chart-scroll" style={{ minHeight: Math.min(height, 620) }}><div style={{ height, minWidth: 560 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 120, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" domain={[0, max]} tick={{ fontSize: 11, fill: "#64748b" }} /><YAxis dataKey="name" type="category" width={116} tick={{ fontSize: 10, fill: "#475569" }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey={valueKey} fill={color} radius={[0, 7, 7, 0]}>{data.map((entry) => <Cell cursor={onSelect ? "pointer" : "default"} fill={color} key={String(entry.name)} onClick={() => onSelect?.(String(entry.name))} />)}</Bar></BarChart></ResponsiveContainer></div></div>;
}

export function ScatterPerformanceChart({ data }: { data: Array<{ uid: string; name: string; aptitude: number; coding: number; piri: number }> }) {
  return <div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 16, bottom: 12, left: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" dataKey="aptitude" name="Aptitude" domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: "Aptitude", position: "insideBottom", offset: -8, fontSize: 11 }} /><YAxis type="number" dataKey="coding" name="Coding" domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: "Coding", angle: -90, position: "insideLeft", fontSize: 11 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={tooltipStyle} formatter={(value, name) => [value, name]} labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? "Student"} /><Scatter data={data} fill="#0EA5A8"><Cell /></Scatter></ScatterChart></ResponsiveContainer></div>;
}

export function DonutChart({ data, onSelect }: { data: Array<{ name: string; value: number }>; onSelect?: (name: string) => void }) {
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2}>{data.map((entry, index) => <Cell cursor={onSelect ? "pointer" : "default"} fill={CHART_COLORS[index % CHART_COLORS.length]} key={entry.name} onClick={() => onSelect?.(entry.name)} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div>;
}

export function BranchReadinessChart({ data }: { data: Array<{ name: string; ready: number; developing: number; support: number }> }) {
  const height = Math.max(250, data.length * 54);
  return <div className="chart-wrap branch-comparison-chart" style={{ height }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ top: 12, right: 18, left: 10, bottom: 12 }} barSize={20}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: "#64748b" }} /><YAxis dataKey="name" type="category" width={58} tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`]} /><Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="ready" name="Ready" stackId="readiness" fill="#16a34a" radius={[7, 0, 0, 7]} /><Bar dataKey="developing" name="Developing" stackId="readiness" fill="#f59e0b" /><Bar dataKey="support" name="Priority support" stackId="readiness" fill="#dc2626" radius={[0, 7, 7, 0]} /></BarChart></ResponsiveContainer></div>;
}

export function BranchCapabilityChart({ data }: { data: Array<{ name: string; aptitude: number; coding: number }> }) {
  const height = Math.max(250, data.length * 54);
  return <div className="chart-wrap branch-comparison-chart" style={{ height }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ top: 12, right: 18, left: 10, bottom: 12 }} barGap={2} barSize={9}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} /><YAxis dataKey="name" type="category" width={58} tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} /><ReferenceLine x={75} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "75", position: "insideTopRight", fontSize: 9, fill: "#64748b" }} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}/100`]} /><Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="aptitude" name="Aptitude" fill="#0ea5a8" radius={[0, 6, 6, 0]} /><Bar dataKey="coding" name="Coding" fill="#315b8a" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>;
}

export function BranchPackageChart({ data }: { data: Array<{ name: string; premium: number; growth: number; core: number; foundation: number }> }) {
  const height = Math.max(250, data.length * 54);
  return <div className="chart-wrap branch-comparison-chart" style={{ height }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ top: 12, right: 18, left: 10, bottom: 12 }} barSize={20}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: "#64748b" }} /><YAxis dataKey="name" type="category" width={58} tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`]} /><Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="premium" name="8+ LPA" stackId="package" fill="#7c3aed" radius={[7, 0, 0, 7]} /><Bar dataKey="growth" name="5–8 LPA" stackId="package" fill="#0ea5a8" /><Bar dataKey="core" name="3.5–5 LPA" stackId="package" fill="#d9a521" /><Bar dataKey="foundation" name="Below 3.5 LPA" stackId="package" fill="#94a3b8" radius={[0, 7, 7, 0]} /></BarChart></ResponsiveContainer></div>;
}

export function BranchExecutiveComparisonChart({ data }: { data: Array<{ name: string; readiness: number; piri: number; aptitude: number; coding: number; competency: number; packagePotential: number }> }) {
  const metrics = [
    { metric: "Ready %", key: "readiness" },
    { metric: "PIRI index", key: "piri" },
    { metric: "Aptitude", key: "aptitude" },
    { metric: "Coding", key: "coding" },
    { metric: "Competency", key: "competency" },
    { metric: "5+ LPA", key: "packagePotential" },
  ].map(({ metric, key }) => ({ metric, ...Object.fromEntries(data.map((branch) => [branch.name, branch[key as keyof typeof branch]])) }));
  return (
    <div className="branch-executive-chart-scroll">
      <div className="branch-executive-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={metrics} margin={{ top: 24, right: 18, left: -10, bottom: 8 }} barGap={2} barCategoryGap="24%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="metric" tick={{ fontSize: 10, fill: "#475569" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${Number(value).toFixed(1)} / 100`, name]} />
            <Legend iconType="circle" verticalAlign="top" wrapperStyle={{ fontSize: 10, top: 0 }} />
            {data.map((branch, index) => <Bar dataKey={branch.name} fill={CHART_COLORS[index % CHART_COLORS.length]} key={branch.name} radius={[4, 4, 0, 0]} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function heatmapTone(score: number) {
  if (score >= 3.75) return "strong";
  if (score >= 3.25) return "stable";
  return "gap";
}

export function BranchCompetencyHeatmap({ data }: { data: Array<{ name: string; hr: number; psychological: number; technical: number; industry: number }> }) {
  return (
    <div className="competency-overview-heatmap" role="img" aria-label="Branch competency heatmap with scores out of five">
      <div className="competency-heatmap-grid header"><span>Branch</span><span>HR</span><span>Psych.</span><span>Technical</span><span>Industry</span></div>
      {data.map((branch) => <div className="competency-heatmap-grid" key={branch.name}>
        <strong>{branch.name}</strong>
        {(["hr", "psychological", "technical", "industry"] as const).map((key) => <span aria-label={`${branch.name} ${key} ${branch[key].toFixed(2)} out of 5`} className={`competency-heat-cell ${heatmapTone(branch[key])}`} key={key}>{branch[key].toFixed(2)}</span>)}
      </div>)}
      <div className="competency-heat-legend"><span className="strong">Strong 3.75+</span><span className="stable">Stable 3.25–3.74</span><span className="gap">Focus below 3.25</span></div>
    </div>
  );
}

"use client";

import { AlertCircle, CheckCircle2, Clock3, FileSpreadsheet } from "lucide-react";
import { COLUMN_MAPPING_DISPLAY } from "@/lib/constants";
import { useDashboard } from "./dashboard-provider";
import { Card, KpiCard, PageHeader } from "./ui";
import { formatDateTime } from "@/lib/format";

export function DataQualityPage() {
  const { quality } = useDashboard();
  const cards = [
    ["Records loaded", quality.recordsLoaded, "neutral"],
    ["Valid records", quality.validRecords, "positive"],
    ["Valid UID count", quality.validUidCount, "positive"],
    ["Duplicate UIDs", quality.duplicateUids.length, quality.duplicateUids.length ? "warning" : "positive"],
    ["Missing values", quality.missingValueCount, quality.missingValueCount ? "warning" : "positive"],
    ["Out-of-range scores", quality.invalidScoreCount, quality.invalidScoreCount ? "warning" : "positive"],
    ["Missing results", quality.missingResultCount, quality.missingResultCount ? "warning" : "neutral"],
    ["Calculation mismatches", quality.calculationMismatchCount, quality.calculationMismatchCount ? "warning" : "positive"],
  ] as const;
  return (
    <div className="page-stack">
      <PageHeader eyebrow="DATA QUALITY" title="Source integrity and methodology" description="Review import health, calculation differences, methodology and exact column cleaning rules." />
      <div className="kpi-grid">{cards.map(([label, value, tone]) => <KpiCard key={label} label={label} value={value} tone={tone} note={tone === "positive" ? "No action needed" : undefined} />)}</div>
      <div className="grid-2">
        <Card title="Import status" subtitle="Latest active dataset quality"><div className="quality-list"><p><FileSpreadsheet /><span>Detected header row</span><strong>Row {quality.detectedHeaderRow}</strong></p><p><FileSpreadsheet /><span>Source columns</span><strong>{quality.sourceColumnCount}</strong></p><p><Clock3 /><span>Data refresh timestamp</span><strong>{formatDateTime(quality.importedAt)}</strong></p><p><AlertCircle /><span>Repeated generic review text</span><strong>{quality.genericReviewCount}</strong></p><p><CheckCircle2 /><span>Result handling</span><strong>{quality.missingResultCount ? "Result Not Available" : "Source values loaded"}</strong></p></div></Card>
        <Card title="PIRI methodology" subtitle="Recalculated for validation; source values are never overwritten"><div className="methodology"><p><strong>Total PIRI Score</strong><span>Aptitude + Coding + HR Total + Psychological Total + Technical Total + Industry Total</span></p><p><strong>PIRI</strong><span>ROUND(((Aptitude × 20%) + (Coding × 25%) + (HR × 15%) + (Psychological × 15%) + (Technical × 15%) + (Industry × 10%)) ÷ 5, 2)</span></p><p><strong>Grade thresholds</strong><span>A+ ≥ 9.5 · A ≥ 9.0 · B+ ≥ 8.5 · B ≥ 8.0 · C+ ≥ 7.5 · C ≥ 7.0 · D ≥ 6.0 · F below 6.0</span></p><p><strong>Result</strong><span>No PASS / FAIL rule is invented. Blank source values display as “Result Not Available”.</span></p></div></Card>
      </div>
      <Card title="Original-to-cleaned column mapping" subtitle="Position-aware cleaning used during every import"><div className="table-scroll"><table className="data-table"><thead><tr><th>Original Excel heading</th><th>Cleaned application field</th></tr></thead><tbody>{COLUMN_MAPPING_DISPLAY.map(([original, cleaned]) => <tr key={original}><td>{original}</td><th>{cleaned}</th></tr>)}</tbody></table></div></Card>
      {quality.duplicateUids.length ? <Card title="Duplicate UID details" subtitle="These records are blocked from activation"><div className="tag-list">{quality.duplicateUids.map((uid) => <span key={uid}>{uid}</span>)}</div></Card> : null}
    </div>
  );
}

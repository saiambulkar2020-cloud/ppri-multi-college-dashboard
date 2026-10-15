"use client";

import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { ALL_COMPETENCIES, COMPETENCY_GROUPS } from "@/lib/constants";
import { competencyExtremes } from "@/lib/calculations";
import { useDashboard } from "./dashboard-provider";
import { Card, EmptyState, PageHeader, ScorePill } from "./ui";

export function StudentProfilePage({ uid, reportDate }: { uid: string; reportDate: string }) {
  const { students, settings, basePath } = useDashboard();
  function printReport() {
    window.print();
  }
  const student = students.find((item) => item.uid === uid);
  if (!student) return <div className="page-stack"><PageHeader eyebrow="STUDENT PROFILE" title="Student not found" description="The UID is not present in the active dataset." /><EmptyState title="Profile unavailable" description="Return to Student Explorer and choose a student from the active dataset." /></div>;
  const extremes = competencyExtremes(student.competencies);
  return (
    <div className="page-stack student-profile-page">
      <div className="no-print"><PageHeader eyebrow="INDIVIDUAL STUDENT PROFILE" title={student.name} description={`${student.uid} · ${student.branch} · ${student.section}`} actions={<div className="flex flex-wrap gap-2"><Link className="btn-secondary" href={`${basePath}/students`}><ArrowLeft /> Back</Link><button className="btn-secondary" onClick={printReport}><Printer /> Print</button><button className="btn-primary" onClick={printReport}><Download />Download PDF</button></div>} /></div>
      <article className="print-report">
        <header className="report-header"><div className="report-logo" style={settings.instituteLogo ? { backgroundImage: `url(${settings.instituteLogo})` } : undefined}>{settings.instituteLogo ? null : "PI"}</div><div><p>{settings.instituteName}</p><h1>Placement Readiness Report</h1><span>Confidential individual assessment</span></div><div className="report-date"><span>Report date</span><strong>{reportDate}</strong></div></header>
        <section className="report-student"><div><p>STUDENT</p><h2>{student.name}</h2><span>UID {student.uid}</span></div><dl><div><dt>Batch</dt><dd>{student.batch}</dd></div><div><dt>Semester</dt><dd>{student.semester}</dd></div><div><dt>Branch</dt><dd>{student.branch}</dd></div><div><dt>Section</dt><dd>{student.section}</dd></div></dl></section>
        <section className="report-kpis"><div><span>Aptitude</span><strong>{student.aptitude}</strong><small>/ 100</small></div><div><span>Coding</span><strong>{student.coding}</strong><small>/ 100</small></div><div className="primary"><span>PIRI</span><strong>{student.piri.toFixed(2)}</strong><small>/ 10</small></div><div><span>Total PIRI Score</span><strong>{student.totalPiriScore}</strong></div><div><span>Grade</span><strong>{student.grade}</strong></div><div><span>Package</span><strong>{student.estimatedPackage}</strong></div></section>
        <div className="report-grid">
          <section className="report-card"><h3>Competency group totals</h3><div className="group-score-list">{COMPETENCY_GROUPS.map((group) => <div key={group.key}><span>{group.label}</span><strong>{student.groupTotals[group.key]} / 20</strong><i><b style={{ width: `${(student.groupTotals[group.key] / 20) * 100}%` }} /></i></div>)}</div></section>
          <section className="report-card"><h3>Strengths & development areas</h3><div className="strength-columns"><div><h4>Top strengths</h4>{extremes.topThree.map((item) => <p key={item.key}><span>{item.label}</span><b>{item.score}/5</b></p>)}</div><div><h4>Development priorities</h4>{extremes.bottomThree.map((item) => <p key={item.key}><span>{item.label}</span><b>{item.score}/5</b></p>)}</div></div></section>
        </div>
        <section className="report-card competency-report"><h3>All sixteen competency scores</h3><div>{ALL_COMPETENCIES.map((item) => <p key={item.key}><span>{item.label}</span><b>{student.competencies[item.key]}</b><i>{Array.from({ length: 5 }, (_, index) => <em className={index < student.competencies[item.key] ? "filled" : ""} key={index} />)}</i></p>)}</div></section>
        <section className="report-notes"><div><h3>Readiness remark</h3><p>{student.remark || "No remark was supplied in the source workbook."}</p></div><div><h3>Trainer review</h3><p>{student.review || "No review was supplied in the source workbook."}</p></div></section>
        <footer className="report-footer"><span>Result: <strong>{student.result ?? "Result Not Available"}</strong></span><span>{settings.footerText}</span></footer>
      </article>
      <div className="no-print"><Card title="Calculation validation" subtitle="Source values remain unchanged"><div className="validation-inline"><span>Total score <ScorePill max={student.totalPiriScore || 1} value={student.totalPiriScore} /></span><span>Recalculated PIRI <strong>{student.recalculatedPiri.toFixed(2)}</strong></span><span>Recalculated grade <strong>{student.recalculatedGrade}</strong></span><span>Difference flags <strong>{Object.values(student.calculationFlags).filter(Boolean).length || "None"}</strong></span></div></Card></div>
    </div>
  );
}

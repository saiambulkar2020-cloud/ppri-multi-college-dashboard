"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { competencyExtremes } from "@/lib/calculations";
import { studentsToCsv } from "@/lib/csv";
import { useDashboard } from "./dashboard-provider";
import { Card, EmptyState, PageHeader, ScorePill } from "./ui";

type SortKey = "name" | "uid" | "branch" | "section" | "aptitude" | "coding" | "piri" | "grade";

export function StudentsPage() {
  const { filteredStudents, settings, basePath, college } = useDashboard();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("piri");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [topN, setTopN] = useState("all");
  const pageSize = settings.recordsPerPage;

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    const searched = filteredStudents.filter((student) => !query || student.uid.toLowerCase().includes(query) || student.name.toLowerCase().includes(query));
    const sorted = [...searched].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const value = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
      return sortDirection === "asc" ? value : -value;
    });
    return topN === "all" ? sorted : sorted.slice(0, Number(topN));
  }, [filteredStudents, search, sortKey, sortDirection, topN]);
  const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
  const visible = results.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);

  function exportCsv() {
    const blob = new Blob([studentsToCsv(results)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ppri-${college.code}-students-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="STUDENT EXPLORER" title="Find, compare and export students" description="Search by UID or name, sort results, select top performers and open a complete student profile." actions={<button className="btn-secondary" disabled={!results.length} onClick={exportCsv}><Download /> Export CSV</button>} />
      <Card>
        <div className="explorer-controls">
          <label className="search-field"><Search /><input aria-label="Search by UID or student name" placeholder="Search UID or student name…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
          <label><span>Sort by</span><select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}><option value="piri">PIRI</option><option value="name">Student name</option><option value="uid">UID</option><option value="branch">Branch</option><option value="section">Section</option><option value="aptitude">Aptitude</option><option value="coding">Coding</option><option value="grade">Grade</option></select></label>
          <label><span>Order</span><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}><option value="desc">High to low / Z–A</option><option value="asc">Low to high / A–Z</option></select></label>
          <label><span>Top N</span><select value={topN} onChange={(event) => { setTopN(event.target.value); setPage(1); }}><option value="all">All students</option><option value="5">Top 5</option><option value="10">Top 10</option><option value="25">Top 25</option></select></label>
        </div>
      </Card>
      {!visible.length ? <EmptyState title="No students found" description="Try a different UID, student name, or global filter." /> : <>
        <Card className="desktop-table-card"><div className="table-scroll"><table className="data-table student-table"><thead><tr><th>UID</th><th>Student Name</th><th>Branch</th><th>Section</th><th>Aptitude</th><th>Coding</th><th>PIRI</th><th>Grade</th><th>Package</th><th>Result</th><th>Strongest</th><th>Weakest</th></tr></thead><tbody>{visible.map((student) => { const extremes = competencyExtremes(student.competencies); return <tr key={student.uid}><td className="mono">{student.uid}</td><th><Link href={`${basePath}/students/${encodeURIComponent(student.uid)}`}>{student.name}</Link></th><td>{student.branch}</td><td>{student.section}</td><td>{student.aptitude}</td><td>{student.coding}</td><td><ScorePill value={student.piri} /></td><td><span className="grade-badge">{student.grade}</span></td><td>{student.estimatedPackage}</td><td>{student.result ?? "Result Not Available"}</td><td>{extremes.strongest.label}</td><td>{extremes.weakest.label}</td></tr>; })}</tbody></table></div></Card>
        <div className="mobile-student-list">{visible.map((student) => { const extremes = competencyExtremes(student.competencies); return <article className="student-card" key={student.uid}><div className="flex items-start justify-between gap-3"><div><Link href={`${basePath}/students/${encodeURIComponent(student.uid)}`}>{student.name}</Link><p>{student.uid} · {student.branch} · {student.section}</p></div><ScorePill value={student.piri} /></div><div className="student-mini-grid"><span>Aptitude <b>{student.aptitude}</b></span><span>Coding <b>{student.coding}</b></span><span>Grade <b>{student.grade}</b></span><span>Package <b>{student.estimatedPackage}</b></span></div><p className="strength-line"><strong>Strength:</strong> {extremes.strongest.label}</p><p className="weak-line"><strong>Develop:</strong> {extremes.weakest.label}</p></article>; })}</div>
        <div className="pagination"><p>Showing {(Math.min(page, pageCount) - 1) * pageSize + 1}–{Math.min(Math.min(page, pageCount) * pageSize, results.length)} of {results.length}</p><div><button aria-label="Previous page" className="icon-button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft /></button><span>Page {Math.min(page, pageCount)} of {pageCount}</span><button aria-label="Next page" className="icon-button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight /></button></div></div>
      </>}
    </div>
  );
}

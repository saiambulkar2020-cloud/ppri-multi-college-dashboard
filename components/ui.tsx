import { Inbox, TrendingDown, TrendingUp } from "lucide-react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>{actions ? <div className="page-actions">{actions}</div> : null}</header>;
}

export function Card({ title, subtitle, action, className = "", children }: { title?: string; subtitle?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return <section className={`card ${className}`}>{title || action ? <div className="card-heading"><div><h3>{title}</h3>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</div> : null}{children}</section>;
}

export function KpiCard({ label, value, note, tone = "neutral" }: { label: string; value: string | number; note?: string; tone?: "neutral" | "positive" | "warning" }) {
  return <article className={`kpi-card ${tone}`}><p>{label}</p><strong>{value}</strong>{note ? <span>{tone === "positive" ? <TrendingUp /> : tone === "warning" ? <TrendingDown /> : null}{note}</span> : null}</article>;
}

export function EmptyState({ title = "No matching students", description = "Clear or change the active filters to see data." }: { title?: string; description?: string }) {
  return <div className="empty-state"><Inbox /><h3>{title}</h3><p>{description}</p></div>;
}

export function ScorePill({ value, max = 10 }: { value: number; max?: number }) {
  const ratio = value / max;
  const className = ratio >= 0.85 ? "score-good" : ratio >= 0.7 ? "score-mid" : "score-low";
  return <span className={`score-pill ${className}`}>{value.toFixed(max === 10 ? 2 : 1)}</span>;
}

export function RankList({ students, basePath, reverse = false }: { students: Array<{ uid: string; name: string; branch: string; piri: number }>; basePath: string; reverse?: boolean }) {
  return <ol className="rank-list">{students.map((student, index) => <li key={student.uid}><span className={`rank-number ${reverse ? "support" : ""}`}>{index + 1}</span><a href={`${basePath}/students/${encodeURIComponent(student.uid)}`}><strong>{student.name}</strong><small>{student.branch} · {student.uid}</small></a><ScorePill value={student.piri} /></li>)}</ol>;
}

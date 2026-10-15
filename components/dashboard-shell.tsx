"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, BrainCircuit, DatabaseZap, GitCompareArrows, LogOut, Settings, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";
import { FilterButton, FilterDrawer } from "./filter-drawer";
import { useDashboard } from "./dashboard-provider";
import { formatDate } from "@/lib/format";
import { collegeDashboardPath } from "@/lib/college-path";

const nav = [
  { href: "/dashboard", label: "College overview", icon: BarChart3 },
  { href: "/dashboard/competencies", label: "Competencies", icon: BrainCircuit },
  { href: "/dashboard/comparison", label: "Compare", icon: GitCompareArrows },
  { href: "/dashboard/students", label: "Students", icon: UsersRound },
  { href: "/dashboard/data-quality", label: "Data quality", icon: ShieldCheck },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { settings, demoMode, currentUser, quality, college, colleges, basePath } = useDashboard();
  const scopedNav = nav.map((item) => ({ ...item, href: item.href.replace("/dashboard", basePath) }));
  const adminPath = `${basePath}/admin`;
  const showAdmin = demoMode || currentUser?.role === "admin";
  const active = (href: string) => href === basePath ? pathname === href : pathname.startsWith(href);

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Link className="sidebar-brand" href={basePath}><span className="brand-mark small">PI</span><span><strong>PPRI / PIRI</strong><small>{college.code} · Readiness analytics</small></span></Link>
        <nav aria-label="Primary navigation" className="sidebar-nav">
          {scopedNav.map((item) => <Link aria-current={active(item.href) ? "page" : undefined} className={active(item.href) ? "active" : ""} href={item.href} key={item.href}><item.icon /><span>{item.label}</span></Link>)}
        </nav>
        <div className="sidebar-bottom">
          {showAdmin && <Link prefetch={false} className={active(adminPath) ? "active" : ""} href={adminPath}><Settings /><span>Admin & settings</span></Link>}
          <button onClick={() => setFiltersOpen(true)}><SlidersHorizontal /><span>Global filters</span></button>
          {currentUser ? <form action="/api/auth/signout" method="post"><button type="submit"><LogOut /><span>Sign out</span></button></form> : null}
        </div>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <div className="min-w-0"><p className="eyebrow truncate">{settings.instituteName}</p><h1 className="truncate text-lg font-bold text-navy sm:text-xl">{settings.dashboardTitle}</h1></div>
          <div className="flex shrink-0 items-center gap-2">
            {demoMode ? <span className="demo-badge"><DatabaseZap /> Demo Mode</span> : <span className="live-badge"><span /> Live data</span>}
            <div className="hidden sm:block"><FilterButton onClick={() => setFiltersOpen(true)} /></div>
            {showAdmin && <Link prefetch={false} aria-label="Admin and settings" className="icon-button" href={adminPath}><Settings /></Link>}
            {currentUser ? <form action="/api/auth/signout" method="post"><button aria-label="Sign out" className="icon-button" type="submit"><LogOut /></button></form> : null}
          </div>
        </header>
        <div className="college-context-bar">
          {currentUser?.role === "admin" && !demoMode ? <label className="college-switcher"><span>College workspace</span><select aria-label="Select college" value={college.id} onChange={(event) => {
            const suffix = pathname.slice(basePath.length);
            const destination = ["/admin", "/competencies", "/comparison", "/students", "/data-quality"].includes(suffix) ? suffix : "";
            window.location.assign(`${collegeDashboardPath(event.target.value)}${destination}`);
          }}>{colleges.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label>
            : <div><strong>{college.code}</strong><span> {college.name}</span></div>}
          <span className="college-access-label">{currentUser?.role === "admin" ? "Platform administrator" : demoMode ? "Sample dashboard" : "College viewer"}</span>
        </div>
        <div className="mobile-filter-row"><button className="btn-secondary w-full" onClick={() => setFiltersOpen(true)}><SlidersHorizontal /> Filter this dashboard</button></div>
        <main className="main-content">{children}</main>
        <footer className="app-footer"><span>{settings.footerText}</span><span>Updated {formatDate(quality.importedAt)}</span></footer>
      </div>

      <nav aria-label="Mobile navigation" className="mobile-bottom-nav">{scopedNav.slice(0, 5).map((item) => <Link aria-current={active(item.href) ? "page" : undefined} className={active(item.href) ? "active" : ""} href={item.href} key={item.href}><item.icon /><span>{item.label === "Data quality" ? "Quality" : item.label === "College overview" ? "College" : item.label}</span></Link>)}</nav>
      <FilterDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  );
}

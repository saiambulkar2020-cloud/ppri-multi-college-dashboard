"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  GraduationCap,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { average, competencyAverages, dashboardKpis, groupSummary } from "@/lib/analytics";
import { COMPETENCY_GROUPS } from "@/lib/constants";
import type { GroupKey } from "@/lib/types";
import { useDashboard } from "./dashboard-provider";
import { formatDateTime } from "@/lib/format";
import { BranchCapabilityChart, BranchCompetencyHeatmap, BranchExecutiveComparisonChart, BranchPackageChart, BranchReadinessChart } from "./charts";
import { Card, EmptyState, PageHeader } from "./ui";
import { ReportDownload } from "./report-download";

type PlacementStatus = "Leading" | "On track" | "Needs attention";

function getPlacementStatus(averagePiri: number, readyRate: number, supportRate: number, readyThreshold: number): PlacementStatus {
  if (averagePiri >= readyThreshold + 0.25 && readyRate >= 75 && supportRate <= 10) return "Leading";
  if (averagePiri >= readyThreshold - 0.25 && readyRate >= 60 && supportRate <= 20) return "On track";
  return "Needs attention";
}

function statusClass(status: PlacementStatus) {
  if (status === "Leading") return "leading";
  if (status === "On track") return "on-track";
  return "attention";
}

function packageTier(packageBand: string): "premium" | "growth" | "core" | "foundation" {
  const lowerBound = Number(packageBand.match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
  if (lowerBound >= 8) return "premium";
  if (lowerBound >= 5) return "growth";
  if (lowerBound >= 3.5) return "core";
  return "foundation";
}

export function OverviewPage() {
  const { filteredStudents: students, filterCount, quality, settings, basePath, college, currentUser } = useDashboard();
  if (!students.length) {
    return <><PageHeader eyebrow="CENTRAL PLACEMENT CELL" title="College Placement Overview" description="A visual command view of college-wide and branch-level placement readiness." actions={<ReportDownload />} /><EmptyState title={filterCount ? "No matching students" : `No workbook uploaded for ${college.name}`} description={filterCount ? "Clear or change the filters to see students." : currentUser?.role === "admin" ? "Open Admin & settings to upload this college's first Excel workbook." : "The platform administrator has not uploaded this college's workbook yet."} /></>;
  }

  const kpis = dashboardKpis(students);
  const readyThreshold = settings.gradeThresholds.B;
  const supportThreshold = settings.supportPriorityThreshold;
  const readyStudents = students.filter((student) => student.piri >= readyThreshold);
  const supportStudents = students.filter((student) => student.piri < supportThreshold);
  const readyRate = Math.round((readyStudents.length / students.length) * 100);
  const supportRate = Math.round((supportStudents.length / students.length) * 100);
  const collegeStatus = getPlacementStatus(kpis.averagePiri, readyRate, supportRate, readyThreshold);

  const branches = groupSummary(students, "branch").map((branch, index) => {
    const branchStudents = students.filter((student) => student.branch === branch.name);
    const ready = branchStudents.filter((student) => student.piri >= readyThreshold).length;
    const support = branchStudents.filter((student) => student.piri < supportThreshold).length;
    const developing = branchStudents.length - ready - support;
    const branchReadyRate = Math.round((ready / branchStudents.length) * 100);
    const branchSupportRate = Math.round((support / branchStudents.length) * 100);
    const weakest = competencyAverages(branchStudents).at(-1)!;
    const competencyProfile = Object.fromEntries(COMPETENCY_GROUPS.map((group) => [
      group.key,
      average(branchStudents.flatMap((student) => group.competencies.map((competency) => student.competencies[competency.key]))),
    ])) as Record<GroupKey, number>;
    const packageCounts = branchStudents.reduce((counts, student) => {
      counts[packageTier(student.estimatedPackage)] += 1;
      return counts;
    }, { premium: 0, growth: 0, core: 0, foundation: 0 });
    const packageRate = (count: number) => Math.round((count / branchStudents.length) * 100);
    const packageMix = {
      premium: packageRate(packageCounts.premium),
      growth: packageRate(packageCounts.growth),
      core: packageRate(packageCounts.core),
      foundation: packageRate(packageCounts.foundation),
    };
    return {
      ...branch,
      rank: index + 1,
      ready,
      developing,
      support,
      readyRate: branchReadyRate,
      developingRate: Math.round((developing / branchStudents.length) * 100),
      supportRate: branchSupportRate,
      weakest,
      competencyProfile,
      packageMix,
      competencyIndex: average(Object.values(competencyProfile)) * 20,
      packagePotential: packageMix.premium + packageMix.growth,
      status: getPlacementStatus(branch.piri, branchReadyRate, branchSupportRate, readyThreshold),
    };
  });

  const attentionBranches = branches.filter((branch) => branch.status === "Needs attention");
  const lowestReadinessBranch = [...branches].sort((a, b) => a.readyRate - b.readyRate || a.piri - b.piri)[0];
  const highestReadinessBranch = [...branches].sort((a, b) => b.readyRate - a.readyRate || b.piri - a.piri)[0];
  const strongestCodingBranch = [...branches].sort((a, b) => b.coding - a.coding)[0];
  const widestCapabilityGap = [...branches].sort((a, b) => Math.abs(b.aptitude - b.coding) - Math.abs(a.aptitude - a.coding))[0];
  const capabilityFocus = widestCapabilityGap.aptitude > widestCapabilityGap.coding ? "Coding" : "Aptitude";
  const capabilityGap = Math.abs(widestCapabilityGap.aptitude - widestCapabilityGap.coding);
  const weakestCollegeCompetency = competencyAverages(students).at(-1)!;
  const updateDate = formatDateTime(quality.importedAt);

  return (
    <div className="page-stack college-overview-page">
      <PageHeader
        eyebrow="CENTRAL PLACEMENT CELL"
        title={filterCount ? `College Placement Overview | ${students.length} students` : "College Placement Overview"}
        description="One-look visibility of college readiness, branch health, capability balance, and immediate placement-cell priorities."
        actions={<ReportDownload />}
      />

      <section className="college-status-hero">
        <div className="college-status-copy">
          <span className={`placement-status-badge ${statusClass(collegeStatus)}`}>
            {collegeStatus === "Needs attention" ? <CircleAlert /> : <CheckCircle2 />}
            College status: {collegeStatus}
          </span>
          <p className="status-kicker">PLACEMENT READINESS POSITION</p>
          <h3>{readyRate}% of students currently meet the placement-ready benchmark</h3>
          <p>{readyStudents.length} of {students.length} students score at least {readyThreshold.toFixed(1)} PIRI. {supportStudents.length} students require priority intervention.</p>
          <div className="hero-signals">
            <div><UsersRound /><span><strong>{students.length}</strong> students covered</span></div>
            <div><Building2 /><span><strong>{branches.length - attentionBranches.length} / {branches.length}</strong> branches healthy</span></div>
            <div className={supportStudents.length ? "signal-warning" : ""}><ShieldAlert /><span><strong>{supportStudents.length}</strong> priority cases</span></div>
          </div>
        </div>
        <div className="college-status-score" aria-label={`${readyRate} percent placement ready`}>
          <div style={{ "--readiness": `${readyRate * 3.6}deg` } as React.CSSProperties}>
            <strong>{readyRate}%</strong><span>ready</span>
          </div>
          <small>Benchmark: PIRI {readyThreshold.toFixed(1)}+</small>
        </div>
      </section>

      <section className="branch-executive-comparison">
        <div className="section-heading branch-section-heading">
          <div><p className="eyebrow">BRANCH-TO-BRANCH COMPARISON</p><h3>All branches on one shared performance scale</h3></div>
          <Link className="card-link" href={`${basePath}/comparison`}>Open detailed comparison <ArrowRight /></Link>
        </div>
        <BranchExecutiveComparisonChart data={branches.map((branch) => ({
          name: branch.name,
          readiness: branch.readyRate,
          piri: branch.piri * 10,
          aptitude: branch.aptitude,
          coding: branch.coding,
          competency: branch.competencyIndex,
          packagePotential: branch.packagePotential,
        }))} />
        <div className="comparison-callouts">
          <div className="leader"><span>OVERALL LEADER</span><strong>{branches[0].name}</strong><small>{branches[0].piri.toFixed(2)} average PIRI</small></div>
          <div><span>READINESS LEADER</span><strong>{highestReadinessBranch.name}</strong><small>{highestReadinessBranch.readyRate}% placement ready</small></div>
          <div><span>CODING LEADER</span><strong>{strongestCodingBranch.name}</strong><small>{strongestCodingBranch.coding.toFixed(1)} / 100</small></div>
          <div className="attention"><span>PRIORITY BRANCH</span><strong>{lowestReadinessBranch.name}</strong><small>{lowestReadinessBranch.readyRate}% placement ready</small></div>
        </div>
        <p className="comparison-method-note">PIRI and competency scores are normalized to 100 for direct comparison. Package potential represents students estimated at 5 LPA or above.</p>
      </section>

      <div className="grid-2 branch-visual-grid">
        <Card title="Readiness mix by branch" subtitle="The proportion ready, developing, and requiring priority support">
          <BranchReadinessChart data={branches.map((branch) => ({ name: branch.name, ready: branch.readyRate, developing: branch.developingRate, support: branch.supportRate }))} />
        </Card>
        <Card title="Aptitude–coding balance" subtitle="Capability balance highlights where branch-specific training must shift">
          <BranchCapabilityChart data={branches.map(({ name, aptitude, coding }) => ({ name, aptitude, coding }))} />
        </Card>
      </div>

      <div className="grid-2 branch-visual-grid strategic-visual-grid">
        <Card title="Estimated package potential" subtitle="Branch-wise mix of students across expected package bands">
          <BranchPackageChart data={branches.map((branch) => ({ name: branch.name, ...branch.packageMix }))} />
        </Card>
        <Card title="Competency strength heatmap" subtitle="Four readiness domains scored out of 5; warmer cells indicate training gaps">
          <BranchCompetencyHeatmap data={branches.map((branch) => ({ name: branch.name, ...branch.competencyProfile }))} />
        </Card>
      </div>

      <section className="placement-focus-board">
        <div className="focus-board-title"><p className="eyebrow">PLACEMENT CELL FOCUS</p><h3>Three signals to act on now</h3><p>Derived from the active college view</p></div>
        <Link className="focus-signal urgent" href={`${basePath}/comparison`}>
          <span>01</span><div><small>BRANCH READINESS</small><strong>{lowestReadinessBranch.name}</strong><p>{lowestReadinessBranch.readyRate}% ready | {lowestReadinessBranch.ready + lowestReadinessBranch.developing + lowestReadinessBranch.support} students</p></div><ArrowRight />
        </Link>
        <Link className="focus-signal" href={`${basePath}/comparison`}>
          <span>02</span><div><small>CAPABILITY IMBALANCE</small><strong>{widestCapabilityGap.name}: strengthen {capabilityFocus}</strong><p>{capabilityGap.toFixed(1)}-point aptitude–coding gap</p></div><ArrowRight />
        </Link>
        <Link className="focus-signal" href={`${basePath}/competencies`}>
          <span>03</span><div><small>COLLEGE TRAINING PRIORITY</small><strong>{weakestCollegeCompetency.label}</strong><p>{weakestCollegeCompetency.average.toFixed(2)} / 5 | gap {weakestCollegeCompetency.gap.toFixed(2)}</p></div><ArrowRight />
        </Link>
      </section>

      <div className="overview-footer-actions">
        <div className="update-strip"><CalendarClock /><span>Latest dataset refresh</span><strong>{updateDate}</strong></div>
        <Link className="overview-detail-link" href={`${basePath}/students`}><GraduationCap />Open student-level detail<ArrowRight /></Link>
      </div>
    </div>
  );
}

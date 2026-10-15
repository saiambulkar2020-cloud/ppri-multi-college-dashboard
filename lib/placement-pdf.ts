import { jsPDF } from "jspdf";
import { formatDateTime } from "./format";
import type { PlacementReport } from "./placement-report";

const C = { navy: "#0B1F3A", teal: "#087F83", blue: "#285EC7", gold: "#B77A08", red: "#B83A40", green: "#198454", pale: "#F3F6FA", line: "#DCE5EF", muted: "#526276", white: "#FFFFFF" };
const M = 36;
const W = 523;
const GAP = 15;
const HALF = (W - GAP) / 2;
const normalize = (value: string) => value.replace(/[\u2010-\u2015]/g, "-").replace(/₹/g, "Rs. ").replace(/\u00a0/g, " ");
const pct = (value: number) => `${value.toFixed(1).replace(/\.0$/, "")}%`;
const safeDate = (date: string) => Number.isNaN(new Date(date).getTime()) ? "Not available" : formatDateTime(date);

/** Vector text and charts remain crisp when printed; no DOM capture or external service. */
export function createPlacementPdf(report: PlacementReport) {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true, putOnlyUsedFonts: true });
  doc.setProperties({ title: report.title, subject: "Placement readiness and training priorities", author: report.instituteName, creator: "College Placement Cell" });
  doc.setCreationDate(new Date(report.generatedAt));
  const s = report.summary;

  function text(value: string, x: number, y: number, size = 10, color = C.navy, bold = false, align: "left" | "right" | "center" = "left") {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size).setTextColor(color);
    doc.text(normalize(value), x, y, { baseline: "top", align });
  }
  function lines(value: string, width: number, size: number) {
    doc.setFont("helvetica", "normal").setFontSize(size);
    return doc.splitTextToSize(normalize(value), width) as string[];
  }
  function paragraph(value: string, x: number, y: number, width: number, size = 9, color = C.muted) {
    const wrapped = lines(value, width, size);
    wrapped.forEach((line, i) => text(line, x, y + i * size * 1.35, size, color));
    return wrapped.length * size * 1.35;
  }
  function shorten(value: string, width: number, size: number) {
    doc.setFont("helvetica", "normal").setFontSize(size);
    let result = normalize(value);
    if (doc.getTextWidth(result) <= width) return result;
    while (result.length && doc.getTextWidth(`${result}...`) > width) result = result.slice(0, -1);
    return `${result}...`;
  }
  function box(x: number, y: number, width: number, height: number, fill = C.pale) {
    doc.setFillColor(fill).roundedRect(x, y, width, height, 8, 8, "F");
  }
  function bar(x: number, y: number, width: number, value: number, max: number, color: string, height = 7) {
    doc.setFillColor(C.line).rect(x, y, width, height, "F");
    const length = Math.min(1, Math.max(0, value / max)) * width;
    if (length) doc.setFillColor(color).rect(x, y, length, height, "F");
  }
  function header(kicker: string, title: string, subtitle: string) {
    doc.setFillColor(C.teal).rect(0, 0, 595.28, 6, "F");
    text(shorten(report.instituteName, 395, 10), M, 25, 10, C.navy, true);
    text(report.demoMode ? "DEMO / SAMPLE DATA" : "PLACEMENT CELL", M + W, 25, 8, report.demoMode ? C.gold : C.teal, true, "right");
    text(kicker, M, 50, 8, C.teal, true);
    let size = 23;
    while (lines(title, W, size).length > 2 && size > 12) size -= 1;
    lines(title, W, size).slice(0, 2).forEach((line, i) => text(line, M, 67 + i * size * 1.15, size, C.navy, true));
    text(shorten(subtitle, W, 9), M, 121, 9, C.muted);
  }
  function footer() {
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      doc.setDrawColor(C.line).setLineWidth(0.5).line(M, 799, M + W, 799);
      text(shorten(`${report.title} | ${report.demoMode ? "Sample data | " : ""}Confidential - authorised college use`, 420, 7.5), M, 808, 7.5, C.muted);
      text(`${page} / ${pageCount}`, M + W, 808, 8, C.muted, false, "right");
    }
  }

  header("01 / EXECUTIVE SUMMARY", report.title, `Generated ${safeDate(report.generatedAt)} IST | Data refreshed ${safeDate(report.importedAt)} IST`);
  box(M, 145, W, 104, C.navy);
  text(pct(s.readyRate), M + 20, 163, 43, C.white, true);
  text("PLACEMENT READY", M + 20, 217, 8, "#84E2D5", true);
  text(`${s.ready} of ${s.totalStudents} students`, M + 180, 165, 20, C.white, true);
  paragraph(`Meet the PIRI ${report.readyThreshold.toFixed(1)}+ readiness benchmark. ${s.support} ${s.support === 1 ? "student requires" : "students require"} priority support.`, M + 180, 197, 315, 11, "#D9E9F0");

  const kpis = [
    ["STUDENTS COVERED", `${s.totalStudents}`, `${s.sections} sections`],
    ["AVERAGE PIRI", s.averagePiri.toFixed(2), "Score out of 10"],
    ["DEVELOPING", `${s.developing}`, `${pct(s.developingRate)} of students`],
    ["PRIORITY SUPPORT", `${s.support}`, `${pct(s.supportRate)} of students`],
  ];
  kpis.forEach(([label, value, note], i) => {
    const x = M + i * (W + 9) / 4;
    box(x, 261, (W - 27) / 4, 67);
    text(label, x + 11, 272, 7, C.muted, true);
    text(value, x + 11, 287, 24, i === 3 && s.support ? C.red : C.navy, true);
    text(note, x + 11, 315, 7.5, C.muted);
  });

  text("Readiness distribution", M, 346, 12, C.navy, true);
  const readiness = [
    { label: "Ready", count: s.ready, rate: s.readyRate, color: C.green },
    { label: "Developing", count: s.developing, rate: s.developingRate, color: C.gold },
    { label: "Priority support", count: s.support, rate: s.supportRate, color: C.red },
  ];
  let offset = M;
  readiness.forEach(({ rate, color }) => {
    const width = W * rate / 100;
    if (width) doc.setFillColor(color).rect(offset, 370, width, 17, "F");
    offset += width;
  });
  readiness.forEach((item, i) => {
    const x = M + i * 178;
    doc.setFillColor(item.color).circle(x + 3, 403, 3, "F");
    text(`${item.label}: ${item.count} (${pct(item.rate)})`, x + 11, 398, 8.5);
  });

  text("Assessment performance", M, 433, 12, C.navy, true);
  [["Aptitude", s.averageAptitude, C.teal], ["Coding", s.averageCoding, C.blue]].forEach(([label, value, color], i) => {
    const y = 461 + i * 31;
    text(String(label), M, y, 10);
    bar(M + 100, y + 3, 343, Number(value), 100, String(color), 9);
    text(`${Number(value).toFixed(1)} / 100`, M + W, y, 10, C.navy, true, "right");
  });

  text("Estimated package potential", M, 536, 12, C.navy, true);
  text("Student share by expected package band | LPA = lakh INR per annum", M, 555, 8.5, C.muted);
  s.packages.forEach((p, i) => {
    const y = 579 + i * 25;
    const color = [C.teal, C.blue, C.gold, C.muted, "#8592A3"][i];
    text(p.name, M, y, 9);
    bar(M + 110, y + 3, 305, p.percent, 100, color, 8);
    text(`${pct(p.percent)} (${p.count})`, M + W, y, 9, C.navy, true, "right");
  });
  paragraph("Package bands are readiness-based estimates from the dataset, not confirmed offers or placement outcomes. Readiness does not mean a student has been placed.", M, 713, W, 9);
  text(`Scope: ${report.scope.type === "college" ? `All ${s.branches} branches` : shorten(report.scope.branch + " branch only", 250, 9)} | ${s.totalStudents} students in the active dataset`, M, 756, 9, C.navy, true);

  // Six groups per page keeps every comparison label and bar readable as the college grows.
  for (let start = 0; start < report.comparisons.length; start += 6) {
    doc.addPage();
    const groups = report.comparisons.slice(start, start + 6);
    header("02 / COMPARATIVE VIEW", report.scope.type === "college" ? "Branch-to-branch comparison" : `${report.scope.branch} | Section comparison`, `Same scales for every ${report.scope.type === "college" ? "branch" : "section"} | Groups ${start + 1}-${start + groups.length} of ${report.comparisons.length}`);
    const metrics = [
      { title: "Placement ready", unit: "% of students", key: "readyRate", max: 100, color: C.green },
      { title: "Average PIRI", unit: "Score out of 10", key: "averagePiri", max: 10, color: C.blue },
      { title: "Aptitude", unit: "Score out of 100", key: "averageAptitude", max: 100, color: C.teal },
      { title: "Coding", unit: "Score out of 100", key: "averageCoding", max: 100, color: C.blue },
      { title: "Competency", unit: "Average score out of 5", key: "competency", max: 5, color: C.teal },
      { title: "5+ LPA potential", unit: "% in estimated 5+ LPA bands", key: "packagePotential", max: 100, color: C.gold },
    ] as const;
    metrics.forEach((metric, i) => {
      const x = M + i % 2 * (HALF + GAP);
      const y = 146 + Math.floor(i / 2) * 188;
      box(x, y, HALF, 175);
      text(metric.title, x + 13, y + 12, 11, C.navy, true);
      text(metric.unit, x + 13, y + 28, 7.5, C.muted);
      groups.forEach((g, j) => {
        const rowY = y + 50 + j * 19;
        const value = g[metric.key];
        const label = lines(g.name, 75, 8);
        text(label[0], x + 13, rowY, 8);
        if (label.length > 1) text(shorten(label.slice(1).join(" "), 75, 7), x + 13, rowY + 8, 7);
        bar(x + 96, rowY + 3, 104, value, metric.max, metric.color);
        text(metric.max === 100 && (metric.key === "readyRate" || metric.key === "packagePotential") ? pct(value) : value.toFixed(1), x + HALF - 12, rowY, 8, C.navy, true, "right");
      });
    });
    paragraph("Ordered by placement readiness, then average PIRI. Full group names and student counts appear in the report context. Long chart labels may be abbreviated.", M, 720, W, 8.5);
    text("Comparisons describe readiness and capability; package potential remains an estimate.", M, 773, 8, C.muted);
  }

  doc.addPage();
  header("03 / COMPETENCIES & ACTIONS", "Training priorities", `${report.scope.type === "college" ? "Overall college" : report.scope.branch + " branch only"} | ${s.totalStudents} students | Competencies scored out of 5`);
  report.domains.forEach((domain, i) => {
    const x = M + i % 2 * (HALF + GAP);
    const y = 146 + Math.floor(i / 2) * 164;
    box(x, y, HALF, 151);
    const labels = { hr: "HR & professional qualities", psychological: "Psychological readiness", technical: "Technical interview", industry: "Industry & application" };
    text(labels[domain.key], x + 12, y + 12, 10, C.navy, true);
    text(`${domain.average.toFixed(2)} / 5`, x + HALF - 12, y + 28, 8, C.teal, true, "right");
    domain.competencies.forEach((c, j) => {
      const rowY = y + 47 + j * 25;
      text(shorten(c.label, HALF - 67, 7.5), x + 12, rowY, 7.5);
      text(c.average.toFixed(2), x + HALF - 12, rowY, 8, C.navy, true, "right");
      bar(x + 12, rowY + 13, HALF - 24, c.average, 5, c.average >= 4 ? C.green : c.average >= 3.5 ? C.teal : C.gold, 4);
    });
  });
  text("Three training priorities", M, 480, 12, C.navy, true);
  text("Lowest average competencies in this report's scope; suggested actions for the next cycle.", M, 499, 8.5, C.muted);
  report.trainingActions.forEach((item, i) => {
    const y = 521 + i * 59;
    doc.setFillColor(C.gold).rect(M, y, 3, 49, "F");
    text(shorten(`${i + 1}. ${item.title}`, 443, 9.5), M + 12, y + 2, 9.5, C.navy, true);
    text(`${item.score.toFixed(2)} / 5`, M + W, y + 2, 9, C.gold, true, "right");
    paragraph(item.action, M + 12, y + 19, W - 12, 8.5);
  });
  text("READING THIS REPORT", M, 711, 8, C.teal, true);
  paragraph(`Ready: PIRI >= ${report.readyThreshold.toFixed(1)}. Priority support: PIRI < ${Math.min(report.readyThreshold, report.supportThreshold).toFixed(1)}. Remaining students: developing. Percentages are rounded for display. No individual student records are included.`, M, 727, W, 8.5);
  text("Prepared by: ________________________", M, 776, 8, C.muted);
  text("Reviewed by: ________________________", M + HALF + GAP, 776, 8, C.muted);

  // Full provenance is allowed to flow to extra pages for long cohort/source labels.
  doc.addPage();
  header("04 / REPORT CONTEXT", "Scope & methodology", "Dataset context and definitions for the receiving college or department");
  let y = 153;
  const notes = [
    ["INSTITUTION", report.instituteName],
    ["REPORT SCOPE", report.scope.type === "college" ? `Overall college: all ${s.branches} branches and ${s.totalStudents} students in the active dataset.` : `${report.scope.branch} branch only: ${s.totalStudents} students and ${s.sections} sections. No other branch is included.`],
    ["BATCHES", report.batches.join(", ") || "Not specified"],
    ["SEMESTERS", report.semesters.join(", ") || "Not specified"],
    [report.scope.type === "college" ? "BRANCH COVERAGE" : "SECTION COVERAGE", report.comparisons.map((g) => `${g.name}: ${g.totalStudents} students`).join("; ")],
    ["SOURCE DATASET", `${report.source} | Version: ${report.sourceId}`],
    ["DATES", `Generated: ${safeDate(report.generatedAt)} IST. Dataset refresh: ${safeDate(report.importedAt)} IST.`],
    ["DATA MODE", report.demoMode ? "DEMO / SAMPLE DATA. This report illustrates the dashboard and must not be presented as actual college placement results." : "Active college dataset. Figures describe the records available in the dashboard at export time."],
    ["READINESS & SCORES", `Readiness uses the configured PIRI threshold of ${report.readyThreshold.toFixed(1)}. Average PIRI is shown out of 10; aptitude and coding out of 100; competencies out of 5. These are readiness assessments, not confirmed placement outcomes.`],
    ["PACKAGE ESTIMATES", "Package categories use the lower bound of each student's estimated package band. Blank or unrecognised bands appear as Not specified. 5+ LPA potential counts students in the 5 to <8 and 8+ bands. These values are not confirmed salaries or offers."],
    ["COVERAGE & ROUNDING", "Reports use all active records for the chosen scope. Screen filters do not apply. Every percentage uses that scope's student count as its denominator. Rounded percentages may not sum to exactly 100%. Training priorities are the three lowest average competencies, not a diagnosis of individual students."],
  ];
  notes.forEach(([label, value]) => {
    text(label, M, y, 8, C.teal, true);
    y += 16;
    for (const line of lines(value, W, 9)) {
      if (y > 770) {
        doc.addPage();
        header("04 / REPORT CONTEXT", "Scope & methodology (continued)", report.title);
        y = 153;
      }
      text(line, M, y, 9, C.muted);
      y += 12;
    }
    y += 19;
    if (y > 745 && label !== notes.at(-1)![0]) {
      doc.addPage();
      header("04 / REPORT CONTEXT", "Scope & methodology (continued)", report.title);
      y = 153;
    }
  });
  footer();
  return doc;
}

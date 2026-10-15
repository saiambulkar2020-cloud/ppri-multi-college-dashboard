"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Download, FileDown, LoaderCircle, X } from "lucide-react";
import { useDashboard } from "./dashboard-provider";

function requestDashboardSignIn(basePath: string) {
  const login = new URL("/login", window.location.origin);
  login.searchParams.set("next", `${basePath}?report=1`);
  window.location.assign(login.href);
}

function downloadFilename(disposition: string | null) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { /* Use the plain filename if needed. */ }
  }
  return disposition?.match(/filename="([^"]+)"/i)?.[1] ?? "Placement-Report.pdf";
}

export function ReportDownload() {
  const bundle = useDashboard();
  const dialog = useRef<HTMLDialogElement>(null);
  const resumedReport = useRef(false);
  const [scope, setScope] = useState("college");
  const [branch, setBranch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedCount = scope === "college" ? bundle.students.length : bundle.students.filter((s) => s.branch === branch).length;
  const initialBranch = bundle.filters.branch || bundle.options.branch[0] || "";
  const initialScope = bundle.filters.branch ? "branch" : "college";

  const open = useCallback(() => {
    setBranch(initialBranch);
    setScope(initialScope);
    setMessage("");
    setError("");
    if (!dialog.current?.open) dialog.current?.showModal();
  }, [initialBranch, initialScope]);

  useEffect(() => {
    if (resumedReport.current || new URLSearchParams(window.location.search).get("report") !== "1") return;
    resumedReport.current = true;
    void open();
  }, [open]);

  async function download() {
    if (busy || !selectedCount) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/reports/pdf", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeId: bundle.college.id, ...(scope === "college" ? { type: "college" } : { type: "branch", branch }) }),
      });
      if (response.status === 401) {
        setError("Your sign-in session has expired. Please sign in again.");
        requestDashboardSignIn(bundle.basePath);
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "The PDF could not be generated. Please try again.");
      }
      if (!response.headers.get("Content-Type")?.startsWith("application/pdf")) throw new Error("The server did not return a PDF. Please try again.");
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadFilename(response.headers.get("Content-Disposition"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`${scope === "college" ? "Overall College Report" : `${branch || "Unassigned"} Branch Report`} is ready. Your PDF download has started.`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "The PDF could not be generated. Please refresh the dashboard and retry.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="btn-primary report-open" onClick={open} disabled={!bundle.students.length}><FileDown />Download PDF</button>
    <dialog ref={dialog} className="report-dialog" aria-labelledby="report-dialog-title" aria-describedby="report-dialog-description" onCancel={(event) => { if (busy) event.preventDefault(); }}>
      <header className="report-dialog-header">
        <span className="report-dialog-icon"><FileDown /></span>
        <button type="button" className="icon-button" aria-label="Close report download" disabled={busy} onClick={() => dialog.current?.close()}><X /></button>
      </header>
      <p className="eyebrow">COLLEGE HANDOVER REPORTS</p>
      <h2 id="report-dialog-title">{bundle.college.name} placement report</h2>
      <p id="report-dialog-description">A print-ready PDF with readiness, package potential, competencies and training priorities.</p>
      <fieldset className="report-scope-options" disabled={busy}>
        <legend>Report scope</legend>
        <label className={scope === "college" ? "selected" : ""}><input type="radio" name="reportScope" value="college" checked={scope === "college"} onChange={() => { setScope("college"); setMessage(""); }} /><Building2 /><span><strong>Overall college</strong><small>College summary and all-branch comparison</small></span></label>
        <label className={scope === "branch" ? "selected" : ""}><input type="radio" name="reportScope" value="branch" checked={scope === "branch"} onChange={() => { setScope("branch"); setMessage(""); }} /><FileDown /><span><strong>Individual branch</strong><small>Only the selected branch and its sections</small></span></label>
      </fieldset>
      {scope === "branch" && <div className="report-branch-select"><label htmlFor="report-branch">Select branch</label><select id="report-branch" value={branch} disabled={busy} onChange={(event) => { setBranch(event.target.value); setMessage(""); }}>{bundle.options.branch.map((name) => <option key={name} value={name}>{name || "Unassigned"}</option>)}</select></div>}
      <div className="report-scope-note"><strong>{selectedCount} students · {scope === "college" ? `${bundle.options.branch.length} branches` : `${branch || "Unassigned"} branch only`}</strong><p>Uses the complete active dataset for this scope. Dashboard filters are not applied.</p>{bundle.demoMode && <p className="report-demo-note">Demo data is active. The PDF will be marked as a sample report.</p>}</div>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <p role="status" aria-live="polite" className="report-download-status">{busy ? "Preparing your report…" : message}</p>
      <button type="button" className="btn-primary report-download-button" disabled={busy || !selectedCount} onClick={download}>{busy ? <LoaderCircle className="report-spinner" /> : <Download />}{busy ? "Generating PDF…" : "Download PDF report"}</button>
      <p className="report-local-note">Available to dashboard users. Ready to print or share with your college.</p>
    </dialog>
  </>;
}

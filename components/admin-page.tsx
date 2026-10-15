"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudUpload, FileSpreadsheet, History, LoaderCircle, RotateCcw, Save, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboard } from "./dashboard-provider";
import { Card, PageHeader } from "./ui";
import type { DashboardSettings, DataQualitySummary } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

type Preview = { filename: string; newStudentCount: number; updatedStudentCount: number; canActivate: boolean; quality: DataQualitySummary; warnings: string[] };

function requestAdminLogin(status: number) {
  if (status === 401) window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
}

function requestWithProgress(url: string, file: File, collegeId: string, onProgress: (progress: number) => void): Promise<Preview> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const body = new FormData();
    body.append("file", file);
    body.append("collegeId", collegeId);
    request.open("POST", url);
    request.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
    request.onload = () => {
      requestAdminLogin(request.status);
      try {
        const payload = JSON.parse(request.responseText);
        if (request.status >= 400) reject(new Error(payload.error ?? "Upload failed.")); else resolve(payload);
      } catch { reject(new Error("The server returned an invalid response.")); }
    };
    request.onerror = () => reject(new Error("Network error while uploading the workbook."));
    request.send(body);
  });
}

export function AdminPage() {
  const { demoMode, currentUser, versions, settings, college } = useDashboard();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DashboardSettings>(settings);
  const weightTotal = useMemo(() => Object.values(draft.weights).reduce((sum, value) => sum + value, 0), [draft.weights]);
  const blocked = demoMode || currentUser?.role !== "admin";

  async function validateFile(selected: File) {
    setFile(selected); setPreview(null); setStatus(""); setBusy(true); setProgress(0);
    try { setPreview(await requestWithProgress("/api/admin/validate", selected, college.id, setProgress)); setStatus(`Validation complete for ${college.name}. Review the summary before activation.`); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Validation failed."); }
    finally { setBusy(false); }
  }

  async function activateUpload() {
    if (!file || !preview?.canActivate || !window.confirm(`Activate ${file.name} for ${college.name} (${college.code})? Only this college's dashboard will change. Its previous version remains available for rollback.`)) return;
    setBusy(true); setProgress(0); setStatus("");
    try { await requestWithProgress("/api/admin/import", file, college.id, setProgress); setStatus("Dataset activated successfully. Refreshing the dashboard…"); router.refresh(); setFile(null); setPreview(null); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Import failed. The current dataset remains active."); }
    finally { setBusy(false); }
  }

  async function restore(id: string, filename: string) {
    if (!window.confirm(`Restore ${filename} for ${college.name} (${college.code})?`)) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datasetId: id, collegeId: college.id }) });
      requestAdminLogin(response.status);
      const payload = await response.json();
      setStatus(response.ok ? "Previous dataset restored successfully." : payload.error ?? "Restore failed.");
      if (response.ok) router.refresh();
    } catch { setStatus("The server could not be reached. Please try again."); }
    finally { setBusy(false); }
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collegeId: college.id, settings: draft }) });
      requestAdminLogin(response.status);
      const payload = await response.json();
      setStatus(response.ok ? "Dashboard settings saved." : payload.error ?? "Could not save settings.");
      if (response.ok) router.refresh();
    } catch { setStatus("The server could not be reached. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="PLATFORM ADMINISTRATION" title={`Manage ${college.name}`} description={`Uploads, history and settings below belong to ${college.code}. Select another college using the workspace selector above.`} />
      {blocked ? <div className="demo-warning"><AlertTriangle /><div><strong>Admin upload is unavailable in Demo Mode.</strong><p>Add Supabase environment variables and sign in as an admin to enable persistent uploads, version history and settings.</p></div></div> : null}
      <Card title="Upload a revised Excel workbook" subtitle="Only .xlsx files up to 4 MB are accepted">
        <div className={`dropzone ${blocked ? "disabled" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const selected = event.dataTransfer.files[0]; if (selected && !blocked) validateFile(selected); }}>
          <UploadCloud /><strong>Drag and drop your PPRI workbook here</strong><p>The file is fully validated before the active dashboard changes.</p><button className="btn-secondary" disabled={blocked || busy} onClick={() => inputRef.current?.click()}><FileSpreadsheet /> Choose Excel File</button><input ref={inputRef} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden type="file" onChange={(event) => event.target.files?.[0] && validateFile(event.target.files[0])} />
        </div>
        {busy && progress ? <div className="upload-progress"><div style={{ width: `${progress}%` }} /><span>{progress}% uploaded</span></div> : null}
        {file ? <p className="selected-file"><FileSpreadsheet /> {file.name} <span>{(file.size / 1024).toFixed(1)} KB</span></p> : null}
        {preview ? <><div className="validation-grid"><div><span>Records</span><strong>{preview.quality.recordsLoaded}</strong></div><div><span>New students</span><strong>{preview.newStudentCount}</strong></div><div><span>Updated students</span><strong>{preview.updatedStudentCount}</strong></div><div className={preview.quality.missingUidCount ? "bad" : "good"}><span>Missing UID</span><strong>{preview.quality.missingUidCount}</strong></div><div className={preview.quality.duplicateUids.length ? "bad" : "good"}><span>Duplicate UID</span><strong>{preview.quality.duplicateUids.length}</strong></div><div className={preview.quality.invalidScoreCount ? "bad" : "good"}><span>Invalid scores</span><strong>{preview.quality.invalidScoreCount}</strong></div><div className={preview.quality.calculationMismatchCount ? "warn" : "good"}><span>Calculation mismatch</span><strong>{preview.quality.calculationMismatchCount}</strong></div></div><div className="validation-action">{preview.canActivate ? <p className="success-text"><CheckCircle2 /> Validation passed. The workbook is ready to activate.</p> : <p className="error-text"><AlertTriangle /> Critical validation errors must be fixed in Excel before activation.</p>}<button className="btn-primary" disabled={!preview.canActivate || busy} onClick={activateUpload}><CloudUpload /> Confirm & activate dataset</button></div></> : null}
      </Card>
      {status ? <div className="status-message" role="status">{busy ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}{status}</div> : null}
      <Card title="Upload history" subtitle="Restore any successfully imported version"><div className="version-list">{versions.map((version) => <article key={version.id}><History /><div><strong>{version.filename}</strong><p>{formatDateTime(version.createdAt)} · {version.validRecords}/{version.totalRecords} valid · {version.uploadedBy}</p></div>{version.active ? <span className="active-version">Active</span> : <button className="btn-secondary compact" disabled={blocked || busy} onClick={() => restore(version.id, version.filename)}><RotateCcw /> Restore</button>}</article>)}</div></Card>
      <Card title="Dashboard settings" subtitle="PIRI weights must total exactly 100%">
        <form className="settings-form" onSubmit={saveSettings}>
          <div className="settings-grid"><label><span>Dashboard title</span><input value={draft.dashboardTitle} onChange={(event) => setDraft({ ...draft, dashboardTitle: event.target.value })} /></label><label><span>Institute name</span><input value={draft.instituteName} onChange={(event) => setDraft({ ...draft, instituteName: event.target.value })} /></label><label><span>Institute logo URL</span><input placeholder="https://…" value={draft.instituteLogo} onChange={(event) => setDraft({ ...draft, instituteLogo: event.target.value })} /></label><label><span>Footer text</span><input value={draft.footerText} onChange={(event) => setDraft({ ...draft, footerText: event.target.value })} /></label><label><span>Primary colour</span><input type="color" value={draft.primaryColor} onChange={(event) => setDraft({ ...draft, primaryColor: event.target.value })} /></label><label><span>Accent colour</span><input type="color" value={draft.accentColor} onChange={(event) => setDraft({ ...draft, accentColor: event.target.value })} /></label><label><span>Support-priority threshold</span><input step="0.1" type="number" value={draft.supportPriorityThreshold} onChange={(event) => setDraft({ ...draft, supportPriorityThreshold: Number(event.target.value) })} /></label><label><span>Records per page</span><input min="5" max="100" type="number" value={draft.recordsPerPage} onChange={(event) => setDraft({ ...draft, recordsPerPage: Number(event.target.value) })} /></label></div>
          <h4 className="form-subheading">PIRI component weights <span className={Math.abs(weightTotal - 1) < 0.0001 ? "good-text" : "error-text"}>Total {(weightTotal * 100).toFixed(0)}%</span></h4><div className="weight-grid">{Object.entries(draft.weights).map(([key, value]) => <label key={key}><span>{key.replace(/([A-Z])/g, " $1")}</span><div><input min="0" max="100" step="1" type="number" value={Math.round(value * 100)} onChange={(event) => setDraft({ ...draft, weights: { ...draft.weights, [key]: Number(event.target.value) / 100 } })} /><b>%</b></div></label>)}</div>
          <h4 className="form-subheading">Grade thresholds</h4><div className="weight-grid">{Object.entries(draft.gradeThresholds).map(([grade, value]) => <label key={grade}><span>{grade}</span><div><input min="0" max="10" step="0.1" type="number" value={value} onChange={(event) => setDraft({ ...draft, gradeThresholds: { ...draft.gradeThresholds, [grade]: Number(event.target.value) } })} /></div></label>)}</div>
          <button className="btn-primary" disabled={blocked || busy || Math.abs(weightTotal - 1) > 0.0001} type="submit"><Save /> Save settings</button>
        </form>
      </Card>
    </div>
  );
}

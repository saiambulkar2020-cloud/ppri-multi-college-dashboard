"use client";

import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";

export function LoginForm({ next, supabaseMode, disabled = false }: { next: string; supabaseMode: boolean; disabled?: boolean }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading || disabled) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password, next }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Sign-in failed. Please try again.");
      if (!payload?.next) throw new Error("Sign-in completed, but the dashboard destination was missing. Please try again.");
      setPassword("");
      window.location.assign(payload.next);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Sign-in failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={submit}>
      <label className="field-label"><span>{supabaseMode ? "Username or email" : "Administrator ID"}</span><span className="input-with-icon"><UserRound /><input autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={supabaseMode ? "viewer1.RCOEM or your email" : "Enter your administrator ID"} required maxLength={254} disabled={loading || disabled} type="text" value={id} onChange={(event) => setId(event.target.value)} /></span></label>
      <div className="field-label"><label htmlFor="access-password">Password</label><span className="input-with-icon login-password"><LockKeyhole /><input id="access-password" autoComplete="current-password" placeholder="Enter your password" required maxLength={1024} disabled={loading || disabled} type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="password-toggle" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff /> : <Eye />}</button></span></div>
      {error ? <p className="alert-error" role="alert">{error}</p> : null}
      <button className="btn-primary w-full" disabled={loading || disabled} type="submit">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}{loading ? "Verifying access…" : "Sign in securely"}</button>
    </form>
  );
}

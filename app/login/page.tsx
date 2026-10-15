import Link from "next/link";
import { ArrowLeft, FileDown, Settings, ShieldCheck } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { accessSessionConfigured, localAccessConfig } from "@/lib/access-session";
import { safeLoginDestination } from "@/lib/access-crypto";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Secure Login" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const params = await searchParams;
  const next = safeLoginDestination(params.next);
  const supabaseMode = isSupabaseConfigured();
  const administratorOnly = !supabaseMode || params.reason === "admin-required";
  const configured = supabaseMode ? accessSessionConfigured() : !!localAccessConfig();
  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand-row"><div className="brand-mark">PI</div><span><ShieldCheck /> Protected access</span></div>
        <p className="eyebrow mt-6">CENTRAL COLLEGE PLACEMENT CELL</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy">{administratorOnly ? "Administrator access" : "Welcome back"}</h1>
        <p className="mt-3 text-slate-600">{next.endsWith("?report=1") ? "Sign in to download your college or branch PDF report." : administratorOnly ? "Enter your administrator ID and password to access Admin & settings and PDF reports." : "Enter your college username or email. Your assigned college dashboard opens automatically."}</p>
        {administratorOnly && <div className="login-permissions"><span><Settings /> Admin & settings</span><span><FileDown /> PDF reports</span></div>}
        {!configured && <p className="alert-error mt-6" role="alert">Administrator access is not configured. Ask the website owner to complete the access setup described in the project README.</p>}
        <LoginForm next={next} supabaseMode={supabaseMode} disabled={!configured && administratorOnly} />
        <p className="login-session-note"><ShieldCheck /> Admin access lasts 30 minutes. Sign out when finished on a shared computer.</p>
        <Link className="login-back" href="/dashboard"><ArrowLeft /> Back to dashboard</Link>
      </section>
    </main>
  );
}

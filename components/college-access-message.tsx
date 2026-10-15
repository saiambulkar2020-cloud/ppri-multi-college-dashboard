import Link from "next/link";

export function CollegeAccessMessage({ code }: { code: string }) {
  const assignment = code === "COLLEGE_ASSIGNMENT_REQUIRED";
  return <main className="login-page"><section className="login-panel">
    <p className="eyebrow">COLLEGE ACCESS</p>
    <h1 className="mt-3 text-2xl font-bold">{assignment ? "Your college has not been assigned" : "This college is unavailable"}</h1>
    <p className="mt-4">{assignment ? "Ask the platform administrator to assign your account to a college in Supabase." : "Your account cannot open this college, or the college is inactive. Open your assigned dashboard or contact the platform administrator."}</p>
    <div className="mt-6 flex flex-wrap gap-3"><Link className="btn-primary" href="/dashboard">Open my dashboard</Link><form action="/api/auth/signout" method="post"><button className="btn-secondary" type="submit">Sign out</button></form></div>
  </section></main>;
}

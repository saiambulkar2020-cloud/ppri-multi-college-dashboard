"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="card max-w-lg text-center">
        <AlertTriangle className="mx-auto size-10 text-red-600" />
        <h1 className="mt-4 text-2xl font-bold text-navy">The dashboard could not load</h1>
        <p className="mt-2 text-slate-600">Your active dataset was not changed. Try loading the page again.</p>
        <button className="btn-primary mt-6" onClick={reset}><RotateCcw className="size-4" /> Try again</button>
      </section>
    </main>
  );
}

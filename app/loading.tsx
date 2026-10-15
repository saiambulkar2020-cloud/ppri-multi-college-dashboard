export default function Loading() {
  return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-7xl space-y-5"><div className="skeleton h-12 w-80" /><div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div className="skeleton h-28" key={index} />)}</div><div className="skeleton h-96" /></div></main>;
}

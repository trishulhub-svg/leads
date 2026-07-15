export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-7" role="status" aria-busy="true">
      <span className="sr-only">Loading workspace…</span>
      <div className="space-y-3">
        <div className="h-3 w-28 rounded-full bg-muted" />
        <div className="h-8 w-72 max-w-full rounded-lg bg-muted" />
        <div className="h-4 w-[30rem] max-w-full rounded bg-muted/70" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 rounded-xl border bg-card/70" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.65fr]">
        <div className="h-80 rounded-xl border bg-card/70" />
        <div className="h-80 rounded-xl border bg-card/70" />
      </div>
    </div>
  );
}

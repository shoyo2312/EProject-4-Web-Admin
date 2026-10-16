/**
 * Shown the moment a section is opened, while its page reads the services. Every page here is
 * rendered per request, through the gateway to four or five services, so without it a click in
 * the sidebar looks ignored until the slowest of them answers.
 */
export default function Loading() {
  return (
    <div role="status" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="mb-5 h-8 w-56 rounded-md bg-surface-muted" />
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 rounded-xl border border-line bg-surface" />
        ))}
      </div>
      <div className="h-80 rounded-xl border border-line bg-surface" />
    </div>
  );
}

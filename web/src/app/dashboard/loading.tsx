/**
 * Shown the moment a dashboard link is clicked, inside the sidebar layout, until the page arrives.
 * It can't know the teacher's language (that needs the request), so it is wordless but for screen
 * readers.
 */
export default function DashboardLoading() {
  return (
    <main className="dash-content" aria-busy="true">
      <p className="sr-only" role="status">
        লোড হচ্ছে… Loading…
      </p>
      <div className="skeleton h-8 w-60 max-w-full" />
      <div className="skeleton h-4 w-[34rem] max-w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="skeleton h-36" />
        <div className="skeleton h-36" />
        <div className="skeleton h-36" />
      </div>
      <div className="skeleton h-24" />
    </main>
  );
}

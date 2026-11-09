/**
 * Shown the moment a link on a teacher's website is clicked, under the site's header, until the
 * page arrives. Wordless but for screen readers: the site's language needs the request.
 */
export default function SiteLoading() {
  return (
    <main aria-busy="true">
      <p className="sr-only" role="status">
        লোড হচ্ছে… Loading…
      </p>
      <div className="wrap flex flex-col gap-5 py-8">
        <div className="skeleton h-4 w-56 max-w-full" />
        <div className="skeleton h-32" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="skeleton h-40" />
          <div className="skeleton h-40" />
          <div className="skeleton h-40" />
        </div>
      </div>
    </main>
  );
}

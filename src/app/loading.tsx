// Shown while a page waits on the server. On the free tier the database may
// take a few seconds to wake up after a quiet spell, so say so kindly.
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center" role="status">
      <span className="size-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" aria-hidden />
      <p className="mt-6 font-semibold">Loading…</p>
      <p className="mt-1 text-sm text-muted">
        If the site has been quiet for a while it can take a few seconds to wake up. Thanks for your patience!
      </p>
    </div>
  );
}

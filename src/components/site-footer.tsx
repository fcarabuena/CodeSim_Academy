export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} CodeSim Academy</p>
        <p>All code runs safely in your browser.</p>
      </div>
    </footer>
  );
}

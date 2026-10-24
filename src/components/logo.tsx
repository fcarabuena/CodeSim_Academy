import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 whitespace-nowrap font-bold tracking-tight">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-indigo-600 font-mono text-sm text-white"
      >
        {"</>"}
      </span>
      <span>
        CodeSim <span className="text-indigo-600 dark:text-indigo-400">Academy</span>
      </span>
    </Link>
  );
}

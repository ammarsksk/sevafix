import Link from "next/link";

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="SevaFix home">
      <span className="grid h-8 w-8 place-items-center rounded-[3px] bg-[var(--accent)] text-white">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="relative h-5 w-5" fill="none">
          <path d="M6.5 12.5 10 16l7.5-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact ? (
        <span className="flex items-baseline gap-0.5 text-[1.06rem] font-bold tracking-[-0.025em] text-[var(--ink)] max-[359px]:hidden">
          Seva<span className="text-[var(--accent)]">Fix</span>
        </span>
      ) : null}
    </Link>
  );
}

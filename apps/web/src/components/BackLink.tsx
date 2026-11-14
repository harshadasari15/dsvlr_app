import Link from "next/link";

/** Round back-arrow button that returns to the main page. */
export default function BackLink({ href = "/", label = "Back to all tools" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-muted transition hover:-translate-x-0.5 hover:border-accent/60 hover:text-text"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M19 12H5M11 6l-6 6 6 6" />
      </svg>
    </Link>
  );
}

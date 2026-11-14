import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg text-white"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17c3-6 6-6 9 0s6 6 9 0" />
              <path d="M3 8h18" />
            </svg>
          </span>
          <span>Civil Automation Hub</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <ThemeToggle />
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}

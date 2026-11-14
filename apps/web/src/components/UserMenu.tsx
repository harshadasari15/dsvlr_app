"use client";

import type { User } from "@civil/platform";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getPlatform } from "@/lib/platform";

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    getPlatform()
      .auth.currentUser()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null));
    return () => {
      alive = false;
    };
  }, []);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  async function signOut() {
    await getPlatform().auth.signOut();
    setUser(null);
    setOpen(false);
    router.replace("/login");
    router.refresh();
  }

  const initial = (user.email[0] ?? "?").toUpperCase();

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-sm font-semibold transition hover:border-accent/60"
        style={{ color: "var(--accent)" }}
      >
        {/* person icon */}
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="fade-up absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface"
          style={{ boxShadow: "var(--shadow)" }}
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
              aria-hidden
            >
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted">Signed in as</p>
              <p className="truncate text-sm font-medium" title={user.email}>
                {user.email}
              </p>
            </div>
          </div>
          <Link
            href="/history"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm transition hover:bg-surface-2"
          >
            Run history
          </Link>
          <button
            role="menuitem"
            onClick={signOut}
            className="block w-full border-t border-border px-4 py-2.5 text-left text-sm transition hover:bg-surface-2"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

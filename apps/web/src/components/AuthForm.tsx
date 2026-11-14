"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { getPlatform } from "@/lib/platform";
import { safeNext } from "@/lib/safe-next";

type Mode = "login" | "signup";

const COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to use your tools.",
    submit: "Sign in",
    switchText: "New here?",
    switchLink: "Create an account",
    switchHref: "/signup",
  },
  signup: {
    title: "Create your account",
    subtitle: "Free to use. Takes under a minute.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLink: "Sign in",
    switchHref: "/login",
  },
} as const;

const inputCls =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-accent";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === "signup" && password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const { auth } = getPlatform();
      if (mode === "login") await auth.signIn(email.trim(), password);
      else await auth.signUp(email.trim(), password);
      router.replace(next);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      if (message === "CONFIRM_EMAIL") {
        setNotice("Account created. Check your email and click the confirmation link, then sign in.");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8" style={{ boxShadow: "var(--shadow)" }}>
        <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            {mode === "signup" && <p className="mt-1 text-xs text-muted">At least 8 characters.</p>}
          </div>

          {error && (
            <p role="alert" className="rounded-lg p-3 text-sm" style={{ background: "var(--err-bg)", color: "var(--err-fg)" }}>
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-lg p-3 text-sm" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="btn-primary w-full rounded-lg px-5 py-2.5 text-sm font-semibold"
          >
            {busy ? "Please wait…" : copy.submit}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {copy.switchText}{" "}
          <Link
            href={next !== "/" ? `${copy.switchHref}?next=${encodeURIComponent(next)}` : copy.switchHref}
            className="font-medium text-accent hover:underline"
          >
            {copy.switchLink}
          </Link>
        </p>
      </div>
    </main>
  );
}

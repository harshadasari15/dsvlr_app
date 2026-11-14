"use client";

import type { RunRecord } from "@civil/platform";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getPlatform } from "@/lib/platform";
import { getManifest } from "@/lib/registry";
import ToolIcon from "./ToolIcon";

export default function RunList({ limit, emptyText }: { limit: number; emptyText?: string }) {
  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const platform = getPlatform();
        const user = await platform.auth.currentUser();
        if (!user) return;
        const list = await platform.runs.listForUser(user.id, limit);
        if (alive) setRuns(list);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [limit]);

  if (failed) return <p className="text-sm text-muted">Could not load run history.</p>;
  if (!runs) return <p className="text-sm text-muted">Loading…</p>;
  if (runs.length === 0) return <p className="text-sm text-muted">{emptyText ?? "No runs yet."}</p>;

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {runs.map((r) => {
        const manifest = getManifest(r.toolId);
        return (
          <li key={r.id}>
            <Link
              href={`/history/${r.id}`}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition hover:bg-surface-2"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <ToolIcon name={manifest?.icon ?? "default"} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{manifest?.name ?? r.toolId}</span>
                <span className="block truncate text-xs text-muted">{r.inputNames.join(", ")}</span>
              </span>
              <span className="flex items-center gap-3 text-xs text-muted">
                {r.rowCounts.rows !== undefined && <span>{r.rowCounts.rows} rows</span>}
                {r.warnings.length > 0 && (
                  <span className="rounded-full px-2 py-0.5" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
                    {r.warnings.length} warning{r.warnings.length === 1 ? "" : "s"}
                  </span>
                )}
                {r.outputPath && (
                  <span className="rounded-full px-2 py-0.5" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
                    file saved
                  </span>
                )}
                <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString()}</time>
              </span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

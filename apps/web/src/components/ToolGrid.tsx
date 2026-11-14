"use client";

import type { ToolManifest } from "@civil/tool-sdk";
import Link from "next/link";
import { useMemo, useState } from "react";
import ToolIcon from "./ToolIcon";

export default function ToolGrid({ manifests }: { manifests: ToolManifest[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(() => ["All", ...Array.from(new Set(manifests.map((m) => m.category)))], [manifests]);

  const visible = manifests.filter((m) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || `${m.name} ${m.description} ${m.category}`.toLowerCase().includes(q);
    return matchesQuery && (category === "All" || m.category === category);
  });

  return (
    <section id="tools" className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Tools</h2>
        <div className="relative w-full sm:max-w-xs">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools"
            aria-label="Search tools"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none transition focus:border-accent"
          />
        </div>
      </div>

      {categories.length > 2 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={c === category}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                c === category
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-muted hover:text-text"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No tools match your search.
        </p>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((tool, i) => {
            const available = tool.status === "available";
            const inner = (
              <div
                className="fade-up group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent/50"
                style={{ boxShadow: "var(--shadow)", animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
                    <ToolIcon name={tool.icon} />
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background: available ? "var(--ok-bg)" : "var(--surface-2)",
                      color: available ? "var(--ok-fg)" : "var(--muted)",
                    }}
                  >
                    {available ? "Ready" : "Coming soon"}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{tool.name}</h3>
                <p className="mt-0.5 text-xs text-muted">{tool.category}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{tool.description}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted">
                  <span>
                    {tool.inputs.length} input{tool.inputs.length === 1 ? "" : "s"} · Excel / CSV
                  </span>
                  {available && (
                    <span className="inline-flex items-center gap-1 font-medium text-accent transition group-hover:gap-2">
                      Open
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            );
            return (
              <li key={tool.id} className={available ? "" : "opacity-75"}>
                {available ? (
                  <Link href={`/tools/${tool.id}`} className="block h-full rounded-2xl">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

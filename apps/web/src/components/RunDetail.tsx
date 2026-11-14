"use client";

import { readFile } from "@civil/excel";
import type { RunRecord } from "@civil/platform";
import type { LoadedFile } from "@civil/tool-sdk";
import Link from "next/link";
import { useEffect, useState } from "react";
import { downloadBuffer, outputFileName } from "@/lib/filenames";
import { OUTPUT_RETENTION_DAYS } from "@/lib/history";
import { getPlatform } from "@/lib/platform";
import { getManifest } from "@/lib/registry";
import BackLink from "./BackLink";
import ToolIcon from "./ToolIcon";

const PREVIEW_ROWS = 100;
const panel = "rounded-2xl border border-border bg-surface p-5 sm:p-6";

type Load = { state: "loading" } | { state: "missing" } | { state: "error" } | { state: "ready"; run: RunRecord };

export default function RunDetail({ runId }: { runId: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [fileState, setFileState] = useState<"idle" | "loading" | "missing">("idle");
  const [preview, setPreview] = useState<LoadedFile | null>(null);
  const [sheet, setSheet] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const platform = getPlatform();
        const run = await platform.runs.get(runId);
        if (!alive) return;
        if (!run) return setLoad({ state: "missing" });
        setLoad({ state: "ready", run });

        if (run.outputPath && platform.files) {
          setFileState("loading");
          const buf = await platform.files.get(run.outputPath);
          if (!alive) return;
          if (!buf) return setFileState("missing");
          setBuffer(buf);
          setFileState("idle");
          setPreview(await readFile(run.outputName ?? "output.xlsx", buf));
        }
      } catch {
        if (alive) setLoad({ state: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [runId]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      {load.state === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {load.state === "missing" && <NotFound text="This run does not exist, or it belongs to another account." />}
      {load.state === "error" && <NotFound text="Could not load this run. Please try again." />}
      {load.state === "ready" && (
        <Body
          run={load.run}
          buffer={buffer}
          fileState={fileState}
          preview={preview}
          sheet={sheet}
          onSheet={setSheet}
        />
      )}
    </main>
  );
}

function NotFound({ text }: { text: string }) {
  return (
    <div>
      <BackLink />
      <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{text}</p>
    </div>
  );
}

function Body({
  run,
  buffer,
  fileState,
  preview,
  sheet,
  onSheet,
}: {
  run: RunRecord;
  buffer: ArrayBuffer | null;
  fileState: "idle" | "loading" | "missing";
  preview: LoadedFile | null;
  sheet: number;
  onSheet: (i: number) => void;
}) {
  const manifest = getManifest(run.toolId);
  const ranAt = new Date(run.createdAt);
  const name = run.outputName ?? outputFileName(run.toolId, ranAt);
  const expires = new Date(ranAt.getTime() + OUTPUT_RETENTION_DAYS * 86_400_000);
  const active = preview?.sheets[sheet];

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <BackLink />
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
        >
          <ToolIcon name={manifest?.icon ?? "default"} className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{manifest?.name ?? run.toolId}</h1>
          <p className="text-xs text-muted">Run on {ranAt.toLocaleString()}</p>
        </div>
      </header>

      <section className={panel}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Rows" value={run.rowCounts.rows ?? "-"} />
          <Tile label="Warnings" value={run.warnings.length} />
          <Tile label="Tool version" value={run.toolVersion} />
          <Tile label="Run id" value={run.id.slice(0, 8)} />
        </div>

        <h2 className="mt-5 text-sm font-semibold">Input files</h2>
        <ul className="mt-1 list-inside list-disc text-sm text-muted">
          {run.inputNames.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>

        {run.warnings.length > 0 && (
          <>
            <h2 className="mt-5 text-sm font-semibold">Warnings</h2>
            <ul className="mt-2 divide-y divide-border text-sm">
              {run.warnings.map((w, i) => (
                <li key={i} className="py-1.5">
                  {w}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={panel} aria-labelledby="out-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="out-h" className="text-lg font-semibold tracking-tight">
              Output file
            </h2>
            <p className="mt-0.5 font-mono text-xs text-muted">{name}</p>
          </div>
          {buffer && (
            <button
              onClick={() => downloadBuffer(buffer, name)}
              className="btn-primary inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              Download Excel
            </button>
          )}
        </div>

        {fileState === "loading" && <p className="mt-3 text-sm text-muted">Loading the saved file…</p>}
        {!run.outputPath && (
          <p className="mt-3 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)" }}>
            No file is stored for this run. Files are kept for {OUTPUT_RETENTION_DAYS} days, and runs from before file
            storage was enabled have none.
          </p>
        )}
        {fileState === "missing" && (
          <p className="mt-3 rounded-lg p-3 text-sm" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
            The saved file could not be found. It may have been removed.
          </p>
        )}
        {buffer && <p className="mt-2 text-xs text-muted">Kept until {expires.toLocaleDateString()}.</p>}

        {preview && active && (
          <>
            <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
              {preview.sheets.map((s, i) => (
                <button
                  key={s.name}
                  role="tab"
                  aria-selected={i === sheet}
                  onClick={() => onSheet(i)}
                  className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm transition ${
                    i === sheet ? "border-accent font-semibold text-accent" : "border-transparent text-muted hover:text-text"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <div className="mt-3 max-h-[26rem] overflow-auto rounded-xl border border-border">
              <table className="min-w-full text-left text-xs">
                <tbody>
                  {active.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                    <tr key={i} className={`border-t border-border first:border-t-0 ${i === 0 ? "bg-surface-2 font-semibold" : ""}`}>
                      {r.map((v, j) => (
                        <td key={j} className="whitespace-nowrap px-3 py-1.5">
                          {v === null ? "" : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">
              Cell preview only{active.rows.length > PREVIEW_ROWS ? ` (first ${PREVIEW_ROWS} rows)` : ""}. Sketches are in
              the downloaded file.
            </p>
          </>
        )}
      </section>

      {manifest && manifest.status === "available" && (
        <Link
          href={`/tools/${manifest.id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold transition hover:border-accent/60"
        >
          Run again
        </Link>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

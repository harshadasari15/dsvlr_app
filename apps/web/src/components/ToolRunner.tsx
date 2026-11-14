"use client";

import { readFile, tablesToSheets, writeReport, writeWorkbook } from "@civil/excel";
import { BrowserRunner } from "@civil/runner";
import type { InputFiles, ToolResult, ValidationReport } from "@civil/tool-sdk";
import { useRef, useState } from "react";
import { downloadBuffer, outputFileName } from "@/lib/filenames";
import { pruneExpiredOutputs } from "@/lib/history";
import { getPlatform } from "@/lib/platform";
import { getTool } from "@/lib/registry";
import Dropzone from "./Dropzone";
import SketchSvg from "./SketchSvg";

const PREVIEW_ROWS = 200;

const SEVERITY_STYLE = {
  error: { background: "var(--err-bg)", color: "var(--err-fg)" },
  warning: { background: "var(--warn-bg)", color: "var(--warn-fg)" },
  info: { background: "var(--info-bg)", color: "var(--info-fg)" },
} as const;

const STEPS = ["Upload", "Check & run", "Results"];

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition"
              style={{
                background: done || active ? "linear-gradient(135deg, var(--accent), var(--accent-2))" : "var(--surface-2)",
                color: done || active ? "#fff" : "var(--muted)",
              }}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`hidden sm:inline ${active ? "font-semibold" : "text-muted"}`}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "warn" | "err" }) {
  const color = tone === "err" ? "var(--err-fg)" : tone === "warn" ? "var(--warn-fg)" : "var(--text)";
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

const panel = "rounded-2xl border border-border bg-surface p-5 sm:p-6";

export default function ToolRunner({ toolId }: { toolId: string }) {
  const tool = getTool(toolId);
  const [files, setFiles] = useState<InputFiles>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; message?: string } | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState(0);
  const [ranAt, setRanAt] = useState<Date | null>(null);
  const elapsed = useRef<number | null>(null);
  const outputRef = useRef<ArrayBuffer | null>(null);

  if (!tool) return null;
  const { manifest } = tool;
  const ready = manifest.inputs.filter((s) => s.required).every((s) => files[s.id]);
  const step = result ? 2 : busy || report ? 1 : 0;

  async function onPick(slotId: string, file: File | undefined) {
    setResult(null);
    setReport(null);
    setError(null);
    if (!file) {
      setFiles((f) => {
        const next = { ...f };
        delete next[slotId];
        return next;
      });
      return;
    }
    try {
      const loaded = await readFile(file.name, await file.arrayBuffer());
      setFiles((f) => ({ ...f, [slotId]: loaded }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file.");
    }
  }

  async function run() {
    if (!tool) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setReport(null);
    setProgress({ done: 0, total: 1 });
    const t0 = performance.now();
    try {
      await new Promise((r) => setTimeout(r, 0)); // let the UI paint "running"
      const out = await new BrowserRunner().run(tool, files, {}, (done, total, message) =>
        setProgress({ done, total, message }),
      );
      setReport(out.validation);
      if (out.result) {
        const at = new Date();
        outputRef.current = null;
        setRanAt(at);
        setResult(out.result);
        setActiveTable(0);
        void finalizeRun(out.result, at);
      }
      elapsed.current = (performance.now() - t0) / 1000;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const buildOutput = (res: ToolResult) =>
    res.workbook ? writeReport(res.workbook) : writeWorkbook(tablesToSheets(res.tables));

  /**
   * Builds the output workbook once, then stores it with a history entry. Storing is
   * best-effort: a failure never blocks the user's results or download.
   */
  async function finalizeRun(res: ToolResult, ranAt: Date) {
    let buf: ArrayBuffer;
    try {
      buf = await buildOutput(res);
      outputRef.current = buf;
    } catch {
      return;
    }
    try {
      const platform = getPlatform();
      const user = await platform.auth.currentUser();
      if (!user) return;
      const id = crypto.randomUUID();
      const outputName = outputFileName(manifest.id, ranAt);
      let outputPath: string | null = null;
      if (platform.files) {
        try {
          await platform.files.put(`${user.id}/${id}.xlsx`, buf);
          outputPath = `${user.id}/${id}.xlsx`;
        } catch {
          /* keep the history entry even if the file could not be stored */
        }
      }
      await platform.runs.save({
        id,
        userId: user.id,
        toolId: manifest.id,
        toolVersion: manifest.version,
        createdAt: ranAt.toISOString(),
        inputNames: Object.values(files).map((f) => f.name),
        rowCounts: { rows: res.tables[0]?.rows.length ?? 0 },
        warnings: res.warnings.slice(0, 50),
        outputPath,
        outputName,
      });
      void pruneExpiredOutputs(platform);
    } catch {
      /* history is optional */
    }
  }

  async function downloadTemplate() {
    if (!tool?.template) return;
    downloadBuffer(await writeWorkbook(tool.template()), `${manifest.id}-template.xlsx`);
  }

  async function downloadResult() {
    if (!result || !ranAt) return;
    const buf = outputRef.current ?? (await buildOutput(result));
    downloadBuffer(buf, outputFileName(manifest.id, ranAt));
  }

  const sketches = result?.sketches ?? [];
  const showingSketches = activeTable === (result?.tables.length ?? 0) && sketches.length > 0;
  const table = showingSketches ? undefined : result?.tables[activeTable];
  const issues = report?.issues ?? [];
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  return (
    <div className="mt-8 space-y-5">
      <div className={`${panel} py-4 sm:py-4`}>
        <Stepper current={step} />
      </div>

      <section className={panel} aria-labelledby="upload-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="upload-h" className="text-lg font-semibold tracking-tight">
            Upload input
          </h2>
          {tool.template && (
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium transition hover:border-accent/60"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
              </svg>
              Excel template
            </button>
          )}
        </div>

        <div className="mt-4 space-y-5">
          {manifest.inputs.map((slot) => (
            <Dropzone key={slot.id} slot={slot} loaded={files[slot.id]} disabled={busy} onFile={(f) => onPick(slot.id, f)} />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button onClick={run} disabled={!ready || busy} className="btn-primary rounded-lg px-6 py-2.5 text-sm font-semibold">
            {busy ? "Processing…" : "Run"}
          </button>
          {!ready && <span className="text-xs text-muted">Add the required file(s) to continue.</span>}
        </div>
      </section>

      {busy && progress && (
        <section className={panel} aria-live="polite">
          <h2 className="text-lg font-semibold tracking-tight">Processing</h2>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(6, Math.round((progress.done / Math.max(progress.total, 1)) * 100))}%`,
                background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">{progress.message ?? "Working…"}</p>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl p-4 text-sm" style={SEVERITY_STYLE.error}>
          {error}
        </p>
      )}

      {report && issues.length > 0 && (
        <section className={`${panel} fade-up`} aria-labelledby="checks-h">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="checks-h" className="text-lg font-semibold tracking-tight">
              Data checks
            </h2>
            {errors > 0 && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={SEVERITY_STYLE.error}>
                {errors} error{errors === 1 ? "" : "s"}
              </span>
            )}
            {warnings > 0 && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={SEVERITY_STYLE.warning}>
                {warnings} warning{warnings === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <ul className="mt-4 divide-y divide-border">
            {issues.map((i, idx) => (
              <li key={idx} className="flex items-start gap-3 py-2 text-sm">
                <span className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-medium" style={SEVERITY_STYLE[i.severity]}>
                  {i.severity}
                </span>
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
          {!report.ok && <p className="mt-3 text-sm font-medium">Fix the errors above, then run again.</p>}
        </section>
      )}

      {result && (
        <section className={`${panel} fade-up`} aria-labelledby="results-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-h" className="text-lg font-semibold tracking-tight">
              Results
            </h2>
            <button onClick={downloadResult} className="btn-primary inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
              </svg>
              Download Excel
            </button>
          </div>

          {ranAt && (
            <p className="mt-2 text-xs text-muted">
              Run at {ranAt.toLocaleString()} · file name:{" "}
              <span className="font-mono">{outputFileName(manifest.id, ranAt)}</span>
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rows" value={result.tables[0]?.rows.length ?? 0} />
            <Stat label="Warnings" value={warnings} tone={warnings > 0 ? "warn" : undefined} />
            <Stat label="Sheets" value={result.workbook?.length ?? result.tables.length} />
            <Stat label="Time" value={elapsed.current !== null ? `${elapsed.current.toFixed(2)} s` : "-"} />
          </div>

          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
            {result.tables.map((t, i) => (
              <button
                key={t.name}
                role="tab"
                aria-selected={i === activeTable}
                onClick={() => setActiveTable(i)}
                className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm transition ${
                  i === activeTable ? "border-accent font-semibold text-accent" : "border-transparent text-muted hover:text-text"
                }`}
              >
                {t.name} <span className="text-xs text-muted">({t.rows.length})</span>
              </button>
            ))}
            {sketches.length > 0 && (
              <button
                role="tab"
                aria-selected={showingSketches}
                onClick={() => setActiveTable(result.tables.length)}
                className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm transition ${
                  showingSketches ? "border-accent font-semibold text-accent" : "border-transparent text-muted hover:text-text"
                }`}
              >
                Sketches <span className="text-xs text-muted">({sketches.length})</span>
              </button>
            )}
          </div>

          {showingSketches && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {sketches.map((sk) => (
                <SketchSvg key={sk.name} sketch={sk} />
              ))}
            </div>
          )}

          {table && (
            <>
              <div className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-border">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface-2">
                    <tr>
                      {table.columns.map((c) => (
                        <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                      <tr key={i} className="border-t border-border odd:bg-transparent even:bg-surface-2/40">
                        {r.map((v, j) => (
                          <td key={j} className={`whitespace-nowrap px-3 py-1.5 ${typeof v === "number" ? "tabular-nums" : ""}`}>
                            {v ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {table.rows.length > PREVIEW_ROWS && (
                <p className="mt-2 text-xs text-muted">
                  Showing first {PREVIEW_ROWS} of {table.rows.length} rows. Download for the full table.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

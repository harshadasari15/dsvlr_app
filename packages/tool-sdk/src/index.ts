/**
 * Tool contract. A tool is a self-contained package: it declares a manifest
 * (drives the UI) and implements pure parse/validate/run functions (no I/O,
 * no UI, no platform imports) so it can run in a browser Web Worker today and
 * on a server later.
 */

import type { RichSheet, SketchPreview } from "./drawing";

export * from "./drawing";

export type ToolStatus = "available" | "coming-soon";
export type ExecutionTarget = "client" | "server";

export interface InputSlot {
  id: string;
  label: string;
  description?: string;
  required: boolean;
  accept: string[]; // e.g. [".xlsx", ".csv"]
  /** Public URL of a downloadable template, once provided. */
  templateUrl?: string;
}

export interface ToolManifest {
  id: string; // url-safe, stable
  name: string;
  description: string;
  category: string;
  icon: string; // icon key resolved by the UI
  version: string; // semver, stored with every run
  status: ToolStatus;
  execution: ExecutionTarget;
  inputs: InputSlot[];
}

export type Severity = "error" | "warning" | "info";
export interface ValidationIssue {
  severity: Severity;
  slot?: string;
  row?: number;
  message: string;
}
export interface ValidationReport {
  ok: boolean; // false if any error
  issues: ValidationIssue[];
}

export interface OutputTable {
  name: string; // becomes the sheet name
  columns: string[];
  rows: (string | number | null)[][];
}
export interface ToolResult {
  tables: OutputTable[];
  warnings: string[];
  /** Optional richly formatted workbook (merges, styles, drawings). Used for the Excel download when present. */
  workbook?: RichSheet[];
  /** Optional on-screen drawings (one per sketch). */
  sketches?: SketchPreview[];
}

export type ProgressFn = (done: number, total: number, message?: string) => void;

export type Cell = string | number | boolean | null;
/** One worksheet (or a CSV file as a single sheet) as rows of cells. */
export interface SheetData {
  name: string;
  rows: Cell[][];
}
/** An uploaded file already decoded into sheets (decoding lives outside tools). */
export interface LoadedFile {
  name: string;
  sheets: SheetData[];
}
/** Decoded uploads keyed by input slot id. */
export type InputFiles = Record<string, LoadedFile>;

export interface Tool<TParsed = unknown, TOptions = Record<string, unknown>> {
  manifest: ToolManifest;
  /** Optional input template (downloadable as .xlsx). */
  template?(): SheetData[];
  parse(files: InputFiles): Promise<TParsed> | TParsed;
  validate(parsed: TParsed): ValidationReport;
  run(parsed: TParsed, options: TOptions, onProgress: ProgressFn): Promise<ToolResult> | ToolResult;
}

/** Where a tool executes. BrowserRunner today; RemoteRunner when a backend exists. */
export interface ExecutionRunner {
  run(
    tool: Tool,
    files: InputFiles,
    options: Record<string, unknown>,
    onProgress: ProgressFn,
  ): Promise<{ validation: ValidationReport; result?: ToolResult }>;
}

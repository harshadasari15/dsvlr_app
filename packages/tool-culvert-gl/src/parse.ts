import { cellNumber, cellText } from "@civil/core";
import type { Cell, InputFiles, SheetData, ValidationIssue } from "@civil/tool-sdk";
import type { AlignRow, Pt } from "./geometry";
import type { ParsedCulvert, StructRow, TopoInfo } from "./types";

/** Sheet for a slot: the sheet named after the slot (so one workbook can feed all slots), else the first sheet. */
const firstSheet = (files: InputFiles, slot: string): SheetData | undefined => {
  const f = files[slot];
  if (!f) return undefined;
  return f.sheets.find((s) => s.name.trim().toLowerCase() === slot) ?? f.sheets[0];
};

/** Numbers of the first `n` cells, or null if any is blank / not numeric (CGL:NUMS). */
function numsOf(cells: Cell[], n: number): number[] | null {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = cellNumber(cells[i]);
    if (v === null || Number.isNaN(v)) return null;
    out.push(v);
  }
  return out;
}

const isBlankRow = (cells: Cell[]) => cells.every((c) => cellText(c) === "");

/** Data rows after the header; rows that are not numeric are counted so they can be reported. */
function readNumericRows(sheet: SheetData, n: number): { rows: number[][]; skipped: number } {
  const rows: number[][] = [];
  let skipped = 0;
  for (let i = 1; i < sheet.rows.length; i++) {
    const cells = sheet.rows[i]!;
    if (isBlankRow(cells)) continue;
    const v = numsOf(cells, n);
    if (v) rows.push(v);
    else skipped++;
  }
  return { rows, skipped };
}

/** Optional numeric cell: null when blank or not a number. */
function optNum(c: Cell | undefined): number | null {
  const n = cellNumber(c);
  return n === null || Number.isNaN(n) ? null : n;
}

const noSpace = (s: string) => s.replace(/ /g, "");

export function parseStructures(sheet: SheetData, issues: ValidationIssue[]): StructRow[] {
  const header = sheet.rows[0] ?? [];
  const col = { us: -1, ds: -1, w: -1, type: -1, skew: -1, h: -1, clear: -1, deck: -1, wear: -1, camber: -1, under: -1 };
  // Optional columns are found by header name, from the 5th column on (as in CGL:READSTRUCT).
  for (let i = 4; i < header.length; i++) {
    const h = cellText(header[i]).toUpperCase();
    if (col.us < 0 && h.includes("CS_US")) col.us = i;
    else if (col.ds < 0 && h.includes("CS_DS")) col.ds = i;
    else if (col.w < 0 && h.includes("CS_W")) col.w = i;
    else if (col.type < 0 && h.includes("TYPE")) col.type = i;
    else if (col.skew < 0 && h.includes("SKEW")) col.skew = i;
    else if (col.h < 0 && (h.includes("HEIGHT") || h.includes("VENT"))) col.h = i;
    else if (col.clear < 0 && h.includes("CLEAR")) col.clear = i;
    else if (col.deck < 0 && h.includes("DECK")) col.deck = i;
    else if (col.wear < 0 && h.includes("WEAR")) col.wear = i;
    else if (col.camber < 0 && h.includes("CAMBER")) col.camber = i;
    else if (col.under < 0 && h.includes("UNDER")) col.under = i;
  }
  const at = (cells: Cell[], c: number): Cell | undefined => (c >= 0 ? cells[c] : undefined);

  const out: StructRow[] = [];
  for (let i = 1; i < sheet.rows.length; i++) {
    const cells = sheet.rows[i]!;
    if (isBlankRow(cells)) continue;
    const v = numsOf(cells, 4);
    if (!v) {
      issues.push({ severity: "warning", slot: "structures", row: i + 1, message: `Structures row ${i + 1}: S.No, Chainage, Span and Length must be numbers; row skipped.` });
      continue;
    }
    const type = noSpace(cellText(at(cells, col.type)).toUpperCase()) || "CULVERT";
    out.push({
      sno: Math.trunc(v[0]!),
      ch: v[1]!,
      span: v[2]!,
      len: v[3]!,
      skew: optNum(at(cells, col.skew)) ?? 0,
      height: optNum(at(cells, col.h)),
      clearance: optNum(at(cells, col.clear)),
      type,
      csUs: cellText(at(cells, col.us)),
      csDs: cellText(at(cells, col.ds)),
      csWidth: optNum(at(cells, col.w)),
      deck: optNum(at(cells, col.deck)),
      wearing: optNum(at(cells, col.wear)),
      camber: optNum(at(cells, col.camber)),
      underRl: optNum(at(cells, col.under)),
    });
  }
  return out;
}

export function parseCentrelines(sheet: SheetData | undefined): Map<number, Pt[]> {
  const res = new Map<number, Pt[]>();
  if (!sheet) return res;
  for (let i = 1; i < sheet.rows.length; i++) {
    const v = numsOf(sheet.rows[i]!, 3);
    if (!v) continue;
    const k = Math.trunc(v[0]!);
    const pt: Pt = [v[1]!, v[2]!];
    const pts = res.get(k);
    if (!pts) res.set(k, [pt]);
    else {
      const last = pts[pts.length - 1]!;
      // Duplicate points (< 1 mm apart) are dropped.
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= 0.001) pts.push(pt);
    }
  }
  for (const [k, pts] of res) if (pts.length < 2) res.delete(k);
  return res;
}

export function parseCulvert(files: InputFiles): ParsedCulvert {
  const issues: ValidationIssue[] = [];
  const names = {
    structures: files["structures"]?.name ?? "",
    alignment: files["alignment"]?.name ?? "",
    topo: files["topo"]?.name ?? "",
  };
  const empty: ParsedCulvert = {
    structures: [],
    alignment: [],
    topo: new Float64Array(0),
    topoInfo: { total: 0, minE: 0, minN: 0, maxE: 0, maxN: 0 },
    centrelines: new Map(),
    hasCentrelineFile: false,
    fileNames: names,
    parseIssues: issues,
  };

  const sSheet = firstSheet(files, "structures");
  const aSheet = firstSheet(files, "alignment");
  const tSheet = firstSheet(files, "topo");
  for (const [slot, sheet] of [["structures", sSheet], ["alignment", aSheet], ["topo", tSheet]] as const) {
    if (!sheet) issues.push({ severity: "error", slot, message: `The ${slot} file is missing.` });
  }
  if (!sSheet || !aSheet || !tSheet) return empty;

  const structures = parseStructures(sSheet, issues);

  const al = readNumericRows(aSheet, 3);
  if (al.skipped > 0) issues.push({ severity: "warning", slot: "alignment", message: `${al.skipped} alignment row(s) were not numeric and were skipped.` });
  const alignment: AlignRow[] = al.rows.map(([ch, e, n]) => ({ ch: ch!, e: e!, n: n! }));

  const flat: number[] = [];
  const info: TopoInfo = { total: 0, minE: 1e99, minN: 1e99, maxE: -1e99, maxN: -1e99 };
  let skipped = 0;
  for (let i = 1; i < tSheet.rows.length; i++) {
    const cells = tSheet.rows[i]!;
    if (isBlankRow(cells)) continue;
    const v = numsOf(cells, 3);
    if (!v) {
      skipped++;
      continue;
    }
    flat.push(v[0]!, v[1]!, v[2]!);
    info.total++;
    if (v[0]! < info.minE) info.minE = v[0]!;
    if (v[1]! < info.minN) info.minN = v[1]!;
    if (v[0]! > info.maxE) info.maxE = v[0]!;
    if (v[1]! > info.maxN) info.maxN = v[1]!;
  }
  if (skipped > 0) issues.push({ severity: "warning", slot: "topo", message: `${skipped} topo row(s) were not numeric and were skipped.` });

  const clSheet = firstSheet(files, "centreline");
  return {
    structures,
    alignment,
    topo: Float64Array.from(flat),
    topoInfo: info,
    centrelines: parseCentrelines(clSheet),
    hasCentrelineFile: Boolean(clSheet),
    fileNames: names,
    parseIssues: issues,
  };
}

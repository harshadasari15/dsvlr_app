import type { OutputTable, ProgressFn, SheetData, Tool, ToolManifest, ToolResult, ValidationIssue, ValidationReport } from "@civil/tool-sdk";
import { kindOf } from "./config";
import { boxSize, computeCulvert } from "./culvert";
import { alignAt } from "./geometry";
import { computeLand } from "./land";
import { chFmt } from "./numeric";
import { buildTables } from "./outputs";
import { parseCulvert } from "./parse";
import { computeStream } from "./stream";
import type { ParsedCulvert, StructRec } from "./types";

export const manifest: ToolManifest = {
  id: "culvert-ground-levels",
  name: "Culvert Ground Levels",
  description:
    "Interpolate ground levels from topo points along culverts, streams and land structures; export summaries and profiles.",
  category: "Highway / Drainage",
  icon: "waves",
  version: "0.1.0",
  status: "available",
  execution: "client",
  inputs: [
    {
      id: "structures",
      label: "Structure locations",
      description: "S.No, Chainage, Span, Length (+ optional Type, Skew, CS_US, CS_DS, CS_Width, Clearance, DeckDepth, WearingCoat, Camber, Under_RL).",
      required: true,
      accept: [".xlsx", ".csv"],
    },
    {
      id: "alignment",
      label: "Alignment coordinates",
      description: "Chainage, Easting, Northing in increasing chainage.",
      required: true,
      accept: [".xlsx", ".csv"],
    },
    {
      id: "topo",
      label: "Topo raw data",
      description: "Easting, Northing, Reduced Level.",
      required: true,
      accept: [".xlsx", ".csv"],
    },
    {
      id: "centreline",
      label: "Stream centreline",
      description: "S.No, Easting, Northing, in order along each stream. Streams follow the culvert axis if omitted.",
      required: false,
      accept: [".xlsx", ".csv"],
    },
  ],
};

/** Port of the input check shown before the CAD tool calculates (CGL:CHECKMSG). */
export function validateCulvert(p: ParsedCulvert): ValidationReport {
  const issues: ValidationIssue[] = [...p.parseIssues];
  const add = (severity: ValidationIssue["severity"], message: string, slot?: string) =>
    issues.push({ severity, message, ...(slot ? { slot } : {}) });

  if (p.structures.length === 0) add("error", "No valid structure rows (S.No, Chainage, Span, Length).", "structures");
  if (p.alignment.length < 2) add("error", "The alignment needs at least 2 valid rows (Chainage, Easting, Northing).", "alignment");
  if (p.topo.length === 0) add("error", "The topo file has no valid rows (Easting, Northing, RL).", "topo");

  let sorted = true;
  for (let i = 1; i < p.alignment.length; i++) if (p.alignment[i]!.ch <= p.alignment[i - 1]!.ch) sorted = false;
  if (!sorted) add("error", "Alignment chainages are not in strictly increasing order. Sort the file.", "alignment");

  const sNos = new Set<number>();
  for (const s of p.structures) {
    if (sNos.has(s.sno)) add("warning", `S.No ${s.sno} appears more than once in the structure file.`, "structures");
    sNos.add(s.sno);
  }

  const { structures: a, alignment: b, topo: c } = p.fileNames;
  if ((a && (a === b || a === c)) || (b && b === c)) {
    add("warning", "The same file name was chosen for more than one input.");
  }

  if (issues.some((i) => i.severity === "error")) return { ok: false, issues };

  const chMin = p.alignment[0]!.ch;
  const chMax = p.alignment[p.alignment.length - 1]!.ch;
  const outside = p.structures.filter((s) => s.ch < chMin || s.ch > chMax).map((s) => s.sno);
  if (outside.length > 0) {
    add("warning", `${outside.length} structure(s) are outside the alignment chainage range (S.No ${outside.join(", ")}); their locations are extrapolated.`, "alignment");
  }

  // Do any topo points lie near any structure? (same bounding box test as the CAD tool)
  let minE = 1e99, minN = 1e99, maxE = -1e99, maxN = -1e99;
  for (const s of p.structures) {
    const ag = alignAt(p.alignment, s.ch);
    const hf = s.len / (s.skew !== 0 ? Math.cos(s.skew * (Math.PI / 180)) : 1.0) / 2;
    const n = boxSize(s, hf, ag.E, ag.N, p.centrelines.get(s.sno)) + 5.0;
    minE = Math.min(minE, ag.E - n); minN = Math.min(minN, ag.N - n);
    maxE = Math.max(maxE, ag.E + n); maxN = Math.max(maxN, ag.N + n);
  }
  let kept = 0;
  for (let i = 0; i < p.topo.length; i += 3) {
    if (p.topo[i]! >= minE && p.topo[i]! <= maxE && p.topo[i + 1]! >= minN && p.topo[i + 1]! <= maxN) kept++;
  }
  if (kept === 0) {
    add("error", "No topo points lie near any structure. The topo and the alignment are probably in different coordinate systems.", "topo");
  }

  const counts = { CULVERT: 0, STREAM: 0, LAND: 0 };
  for (const s of p.structures) counts[kindOf(s.type)]++;
  add(
    "info",
    `${p.structures.length} structures (Ch ${chFmt(Math.min(...p.structures.map((s) => s.ch)))} to ${chFmt(Math.max(...p.structures.map((s) => s.ch)))}): ` +
      `${counts.CULVERT} culvert, ${counts.STREAM} stream, ${counts.LAND} land structure. ` +
      `Alignment ${p.alignment.length} points. Topo ${p.topoInfo.total} points, ${kept} near structures.`,
  );
  if (p.hasCentrelineFile) add("info", `Stream centrelines for ${p.centrelines.size} stream(s).`, "centreline");

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}

export function runCulvert(p: ParsedCulvert, _options: unknown, onProgress: ProgressFn): ToolResult {
  const res: StructRec[] = [];
  const total = p.structures.length;
  p.structures.forEach((s, i) => {
    onProgress(i, total, `Computing S.No ${s.sno} (${i + 1} of ${total})`);
    if (kindOf(s.type) === "LAND") {
      res.push(computeLand(s, p.alignment, p.topo));
      return;
    }
    const cline = p.centrelines.get(s.sno);
    const rec = computeCulvert(s, p.alignment, p.topo, cline);
    if (rec.kind === "STREAM") rec.stream = computeStream(rec, s, cline);
    res.push(rec);
  });
  onProgress(total, total, "Done");

  const tables: OutputTable[] = buildTables(res);
  const report = validateCulvert(p);
  const flagged = res.filter((r) => r.flags !== "OK").length;
  const warnings = report.issues.filter((i) => i.severity === "warning").map((i) => i.message);
  if (flagged > 0) warnings.push(`${flagged} of ${res.length} structures carry check flags (see the Flags column).`);
  const notes = report.issues.filter((i) => i.severity !== "error");
  if (notes.length > 0) {
    tables.push({ name: "Checks", columns: ["Severity", "Message"], rows: notes.map((i) => [i.severity, i.message]) });
  }
  return { tables, warnings };
}

/** Column layouts as downloadable template (each sheet can be saved as its own file, or this workbook used for every slot). */
export function culvertTemplate(): SheetData[] {
  return [
    {
      name: "Structures",
      rows: [
        ["S.No", "Chainage", "Span", "Length", "Type", "Skew", "CS_US", "CS_DS", "CS_Width", "Clearance", "DeckDepth", "WearingCoat", "Camber", "Under_RL"],
        [1, 26050, 4, 30, "CULVERT", 0, null, null, null, null, null, null, null, null],
        [2, 26285, 4, 30, "STREAM", 0, null, null, null, null, null, null, null, null],
      ],
    },
    { name: "Alignment", rows: [["Chainage", "Easting", "Northing"], [26000, 382500, 2072860], [26100, 382598, 2072841]] },
    { name: "Topo", rows: [["Easting", "Northing", "Reduced Level"], [382590.1, 2072850.2, 614.52], [382592.4, 2072851.9, 614.61]] },
    { name: "Centreline", rows: [["S.No", "Easting", "Northing"], [2, 382810, 2072800], [2, 382820, 2072830]] },
  ];
}

export const tool: Tool<ParsedCulvert> = {
  manifest,
  template: culvertTemplate,
  parse: parseCulvert,
  validate: validateCulvert,
  run: runCulvert,
};

export * from "./types";
export { parseCulvert } from "./parse";
export { computeCulvert } from "./culvert";
export { computeStream } from "./stream";
export { computeLand } from "./land";
export { buildTables } from "./outputs";
export { rnd, fmt, chFmt } from "./numeric";

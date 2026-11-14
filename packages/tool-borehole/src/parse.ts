import { cellNumber, cellText } from "@civil/core";
import type { Cell, InputFiles, SheetData, ValidationIssue } from "@civil/tool-sdk";
import type { AlignPoint, Borehole, ParsedBorehole, Structure } from "./types";

type SectionName = "PROJECT_INFO" | "ALIGNMENT_DATA" | "STRUCTURES_DATA" | "BOREHOLES_DATA";
const SECTIONS: SectionName[] = ["PROJECT_INFO", "ALIGNMENT_DATA", "STRUCTURES_DATA", "BOREHOLES_DATA"];

interface Row {
  /** 1-based row number in its sheet, for messages. */
  row: number;
  cells: Cell[];
}

const normName = (s: string) => s.toUpperCase().replace(/[[\]]/g, "").replace(/[\s-]+/g, "_").trim();

function markerOf(cells: Cell[]): SectionName | null {
  const first = cellText(cells[0]).toUpperCase();
  for (const s of SECTIONS) if (first.includes(`[${s}]`)) return s;
  return null;
}

/**
 * Collect rows per section. Supports (a) one sheet per section named like the
 * section, and (b) the original single-sheet / CSV layout with [SECTION]
 * marker rows. Comment (#) and blank rows are skipped.
 */
function extractSections(sheets: SheetData[]): Record<SectionName, Row[]> {
  const out: Record<SectionName, Row[]> = {
    PROJECT_INFO: [],
    ALIGNMENT_DATA: [],
    STRUCTURES_DATA: [],
    BOREHOLES_DATA: [],
  };
  for (const sheet of sheets) {
    const byName = SECTIONS.find((s) => normName(sheet.name) === s) ?? null;
    let current: SectionName | null = byName;
    sheet.rows.forEach((cells, idx) => {
      const marker = markerOf(cells);
      if (marker) {
        current = marker;
        return;
      }
      const first = cellText(cells[0]);
      if (first === "" || first.startsWith("#")) return; // blank / comment / ignored row
      if (current) out[current].push({ row: idx + 1, cells });
    });
  }
  return out;
}

const HEADER_FIRST_CELL: Record<SectionName, string> = {
  PROJECT_INFO: "PARAMETER",
  ALIGNMENT_DATA: "CHAINAGE",
  STRUCTURES_DATA: "STRUCTURE_ID",
  BOREHOLES_DATA: "STRUCTURE_ID",
};

const dataRows = (rows: Row[], section: SectionName) =>
  rows.filter((r) => cellText(r.cells[0]).toUpperCase() !== HEADER_FIRST_CELL[section]);

/** RL/depth: blank, "-", "N/A", text or <= 0.0001 all mean "not available". */
function optionalMeasure(v: Cell | undefined): { value: number | null; bad: boolean } {
  const s = cellText(v);
  if (s === "" || s === "-" || s.toUpperCase() === "N/A") return { value: null, bad: false };
  const n = cellNumber(v);
  if (n === null) return { value: null, bad: false };
  if (Number.isNaN(n)) return { value: null, bad: true };
  return { value: n <= 0.0001 ? null : n, bad: false };
}

/** Pick the sheets of the uploaded file into the typed borehole input model. */
export function parseBorehole(files: InputFiles): ParsedBorehole {
  const file = files["master"];
  const issues: ValidationIssue[] = [];
  const empty: ParsedBorehole = {
    projectInfo: {},
    alignment: [],
    structures: [],
    boreholes: [],
    parseIssues: issues,
  };
  if (!file) {
    issues.push({ severity: "error", slot: "master", message: "No input file provided." });
    return empty;
  }

  const sections = extractSections(file.sheets);
  const err = (section: SectionName, row: number, message: string) =>
    issues.push({ severity: "error", slot: "master", row, message: `${section} row ${row}: ${message}` });
  const warn = (section: SectionName, row: number, message: string) =>
    issues.push({ severity: "warning", slot: "master", row, message: `${section} row ${row}: ${message}` });

  const projectInfo: Record<string, string> = {};
  for (const r of dataRows(sections.PROJECT_INFO, "PROJECT_INFO")) {
    if (r.cells.length >= 2) projectInfo[cellText(r.cells[0])] = cellText(r.cells[1]);
  }

  const alignment: AlignPoint[] = [];
  for (const r of dataRows(sections.ALIGNMENT_DATA, "ALIGNMENT_DATA")) {
    const ch = cellNumber(r.cells[0]);
    const e = cellNumber(r.cells[1]);
    const n = cellNumber(r.cells[2]);
    if (ch === null || e === null || n === null || Number.isNaN(ch + e + n)) {
      err("ALIGNMENT_DATA", r.row, "Chainage, Easting and Northing must all be numbers.");
      continue;
    }
    alignment.push({ ch, e, n, remarks: cellText(r.cells[3]) });
  }
  alignment.sort((a, b) => a.ch - b.ch);

  const structures: Structure[] = [];
  for (const r of dataRows(sections.STRUCTURES_DATA, "STRUCTURES_DATA")) {
    const id = cellText(r.cells[0]);
    const ch = cellNumber(r.cells[3]);
    if (ch !== null && Number.isNaN(ch)) warn("STRUCTURES_DATA", r.row, "Chainage is not a number.");
    const chOk = ch === null || Number.isNaN(ch) ? null : ch;
    // Optional numeric columns: blank means 0 (as in the original tools); text is reported.
    const optNum = (idx: number, label: string): number => {
      const n = cellNumber(r.cells[idx]);
      if (n === null) return 0;
      if (Number.isNaN(n)) {
        warn("STRUCTURES_DATA", r.row, `${label} is not a number; treated as 0.`);
        return 0;
      }
      return n;
    };
    const widthL = optNum(7, "Width_LHS");
    const widthR = optNum(8, "Width_RHS");
    const refRaw = cellNumber(r.cells[10]);
    structures.push({
      id,
      type: cellText(r.cells[1]).toUpperCase(),
      name: cellText(r.cells[2]),
      ch: chOk,
      spans: cellText(r.cells[4]),
      skew: Math.abs(optNum(5, "Skew_Angle_Deg")),
      skewDir: cellText(r.cells[6]).toUpperCase(),
      widthL: widthL <= 0 ? 7.5 : widthL,
      widthR: widthR <= 0 ? 7.5 : widthR,
      crossing: cellText(r.cells[9]),
      refCh: refRaw === null || Number.isNaN(refRaw) ? (chOk ?? 0) : refRaw,
    });
  }

  const boreholes: Borehole[] = [];
  for (const r of dataRows(sections.BOREHOLES_DATA, "BOREHOLES_DATA")) {
    if (r.cells.length < 6) {
      err("BOREHOLES_DATA", r.row, "Expected at least 6 columns (Structure_ID to Side).");
      continue;
    }
    const ch = cellNumber(r.cells[3]);
    const offset = cellNumber(r.cells[4]);
    if (ch === null || Number.isNaN(ch)) {
      err("BOREHOLES_DATA", r.row, "Chainage must be a number.");
      continue;
    }
    if (offset === null || Number.isNaN(offset)) {
      err("BOREHOLES_DATA", r.row, "Offset_m must be a number (use 0 for on-centreline).");
      continue;
    }
    let side = cellText(r.cells[5]).toUpperCase();
    if (side !== "LHS" && side !== "RHS") {
      warn("BOREHOLES_DATA", r.row, `Side "${side}" is not LHS/RHS; treated as LHS.`);
      side = "LHS";
    }
    const rl = optionalMeasure(r.cells[6]);
    const depth = optionalMeasure(r.cells[7]);
    if (rl.bad) warn("BOREHOLES_DATA", r.row, "RL_m is not a number; left blank.");
    if (depth.bad) warn("BOREHOLES_DATA", r.row, "Depth_m is not a number; left blank.");
    boreholes.push({
      structureId: cellText(r.cells[0]),
      bhNo: cellText(r.cells[1]),
      member: cellText(r.cells[2]),
      ch,
      offset,
      side: side as "LHS" | "RHS",
      rl: rl.value,
      depth: depth.value,
      remarks: cellText(r.cells[8]),
    });
  }

  return { projectInfo, alignment, structures, boreholes, parseIssues: issues };
}

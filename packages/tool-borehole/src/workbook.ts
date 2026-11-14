import { formatChainage, roundHalfUp } from "@civil/core";
import type { CellStyle, RichSheet, SheetCell, SketchPreview } from "@civil/tool-sdk";
import { calcBhCoords } from "./calc";
import { buildSketch, fmtLen, toPreview } from "./sketch";
import type { Borehole, ParsedBorehole, Structure } from "./types";

const ORIGIN_Y = 66; // sketch top on the sheet (points): 3 rows x 18 + 12
const HEADER_FILL = "D9E1F2";
const UNKNOWN_FILL = "FFC7CE";

const info = (p: ParsedBorehole, key: string, def = ""): string => {
  const hit = Object.entries(p.projectInfo).find(([k]) => k.toUpperCase() === key);
  return hit && hit[1] ? hit[1] : def;
};

export function safeSheetName(s: string): string {
  return s.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
}

const escFooter = (s: string) => s.replace(/&/g, "&&");

interface StructureSheet {
  sheet: RichSheet;
  preview: SketchPreview;
}

function structureSheet(p: ParsedBorehole, s: Structure, bhs: Borehole[]): StructureSheet {
  const cells: SheetCell[] = [];
  const put = (r: number, c: number, v: string | number | null, st?: CellStyle) => cells.push({ r, c, v, s: st });
  const merges: [number, number, number, number][] = [];
  const rowHeights: Record<number, number> = { 1: 18, 2: 18, 3: 18 };

  // Title block
  put(1, 2, info(p, "PROJECT_NAME"), { bold: true, size: 11, align: "center" });
  merges.push([1, 2, 1, 10]);
  put(2, 2, `${info(p, "DRAWING_TITLE", "BORE HOLE LOCATION PLAN")} - ${s.name}`, { bold: true, size: 12, align: "center" });
  merges.push([2, 2, 2, 10]);
  put(3, 2, `◄ TOWARDS ${info(p, "LEFT_DIRECTION_TOWN").toUpperCase()}`, { bold: true });
  put(3, 10, `TOWARDS ${info(p, "RIGHT_DIRECTION_TOWN").toUpperCase()} ►`, { bold: true, align: "right" });

  // Rows reserved for the sketch (15 pt each) until the sketch area is cleared.
  let r = 4;
  const sketchBottom = ORIGIN_Y + 68 * 4.2 + 12;
  while (54 + 15 * (r - 4) < sketchBottom) {
    rowHeights[r] = 15;
    r++;
  }

  const sketch = buildSketch(s, bhs, p.alignment, ORIGIN_Y);

  // Coordinate table
  put(r, 2, `BORE HOLE & TRIAL PIT COORDINATES - ${s.name}`, { bold: true, align: "center", border: true });
  merges.push([r, 2, r, 10]);
  r++;
  const headers = ["BH NO.", "LOCATION", "CHAINAGE", "OFFSET (M)", "EASTING (X)", "NORTHING (Y)", "G.L. (M)", "DEPTH (M)", "REMARKS"];
  headers.forEach((h, i) =>
    put(r, 2 + i, h, { bold: true, fill: HEADER_FILL, align: "center", wrap: true, border: true, shrink: true }),
  );
  r++;
  for (const b of bhs) {
    const [e, n] = calcBhCoords(b.ch, b.offset, b.side, p.alignment);
    const base: CellStyle = { border: true, shrink: true, align: "center" };
    put(r, 2, b.bhNo, base);
    put(r, 3, b.member, base);
    put(r, 4, formatChainage(b.ch), base);
    put(r, 5, `${fmtLen(b.offset)} ${b.side}`, base);
    put(r, 6, roundHalfUp(e, 3), { ...base, numFmt: "0.000" });
    put(r, 7, roundHalfUp(n, 3), { ...base, numFmt: "0.000" });
    put(r, 8, b.rl === null ? null : roundHalfUp(b.rl, 3), { ...base, numFmt: "0.000" });
    put(r, 9, b.depth === null ? null : roundHalfUp(b.depth, 2), { ...base, numFmt: "0.00" });
    put(r, 10, b.remarks, { border: true, shrink: true });
    r++;
  }
  put(
    r + 1,
    2,
    "NOTES: 1. Sketch not to scale.  2. LHS / RHS w.r.t. direction of increasing chainage.  3. Coordinates computed from PCL alignment (chainage along PCL, offset perpendicular).",
    { italic: true, size: 8 },
  );
  const lastRow = r + 1;

  const sheet: RichSheet = {
    name: safeSheetName(s.id),
    cells,
    merges,
    colWidths: { 1: 2, 2: 9, 3: 20, 4: 12, 5: 11, 6: 15, 7: 15, 8: 11, 9: 11, 10: 24 },
    rowHeights,
    showGrid: false,
    font: { name: "Arial", size: 9 },
    print: {
      landscape: true,
      fitOnePage: true,
      centerH: true,
      area: `A1:J${lastRow}`,
      footerLeft: escFooter(`Client: ${info(p, "CLIENT")}`),
      footerCenter: escFooter(`Consultant: ${info(p, "CONSULTANT")}`),
      footerRight: escFooter(`Date: ${info(p, "DATE")}   Scale: ${info(p, "SCALE", "NTS")}`),
    },
    drawing: sketch.prims,
  };
  return { sheet, preview: toPreview(s, sketch, ORIGIN_Y) };
}

function summarySheet(p: ParsedBorehole): RichSheet {
  const cells: SheetCell[] = [];
  const headers = [
    "Structure_ID", "Structure_Name", "BH_No", "Location", "Chainage", "Offset_m",
    "Side", "Easting_X", "Northing_Y", "GL_RL_m", "Depth_m", "Remarks",
  ];
  headers.forEach((h, i) => cells.push({ r: 1, c: 1 + i, v: h, s: { bold: true, fill: HEADER_FILL, border: true } }));
  p.boreholes.forEach((b, i) => {
    const r = i + 2;
    const st = p.structures.find((x) => x.id.toUpperCase() === b.structureId.toUpperCase());
    const [e, n] = calcBhCoords(b.ch, b.offset, b.side, p.alignment);
    const bd: CellStyle = { border: true };
    cells.push(
      { r, c: 1, v: b.structureId, s: st ? bd : { ...bd, fill: UNKNOWN_FILL } },
      { r, c: 2, v: st?.name ?? "", s: bd },
      { r, c: 3, v: b.bhNo, s: bd },
      { r, c: 4, v: b.member, s: bd },
      { r, c: 5, v: formatChainage(b.ch), s: bd },
      { r, c: 6, v: b.offset, s: bd },
      { r, c: 7, v: b.side, s: bd },
      { r, c: 8, v: roundHalfUp(e, 3), s: { ...bd, numFmt: "0.000" } },
      { r, c: 9, v: roundHalfUp(n, 3), s: { ...bd, numFmt: "0.000" } },
      { r, c: 10, v: b.rl === null ? null : roundHalfUp(b.rl, 3), s: bd },
      { r, c: 11, v: b.depth === null ? null : roundHalfUp(b.depth, 2), s: bd },
      { r, c: 12, v: b.remarks, s: bd },
    );
  });
  return { name: "COORDINATES", cells, autoWidth: true, freezeRows: 1 };
}

/** Per-structure sheets (with native sketches) followed by the COORDINATES summary. */
export function buildReport(p: ParsedBorehole): { sheets: RichSheet[]; sketches: SketchPreview[] } {
  const sheets: RichSheet[] = [];
  const sketches: SketchPreview[] = [];
  for (const s of p.structures) {
    const bhs = p.boreholes.filter((b) => b.structureId.toUpperCase() === s.id.toUpperCase());
    const out = structureSheet(p, s, bhs);
    sheets.push(out.sheet);
    sketches.push(out.preview);
  }
  sheets.push(summarySheet(p));
  return { sheets, sketches };
}

import { formatChainage, roundHalfUp } from "@civil/core";
import type { OutputTable, ProgressFn, ToolResult } from "@civil/tool-sdk";
import { calcBhCoords } from "./calc";
import type { Borehole, ParsedBorehole } from "./types";
import { validateBorehole } from "./validate";
import { buildReport } from "./workbook";

export const COORD_COLUMNS = [
  "Structure_ID",
  "Structure_Name",
  "BH_No",
  "Location_Member",
  "Chainage_m",
  "Chainage_Formatted",
  "Offset_m",
  "Side",
  "Easting_X",
  "Northing_Y",
  "Ground_Level_RL_m",
  "Proposed_Depth_m",
  "Remarks",
];

export function runBorehole(parsed: ParsedBorehole, _options: unknown, onProgress: ProgressFn): ToolResult {
  const rows: OutputTable["rows"] = [];
  const used = new Set<Borehole>();

  const emit = (structureId: string, structureName: string, b: Borehole) => {
    const [e, n] = calcBhCoords(b.ch, b.offset, b.side, parsed.alignment);
    rows.push([
      structureId,
      structureName,
      b.bhNo,
      b.member,
      roundHalfUp(b.ch, 3),
      formatChainage(b.ch),
      roundHalfUp(b.offset, 3),
      b.side,
      roundHalfUp(e, 3),
      roundHalfUp(n, 3),
      b.rl === null ? null : roundHalfUp(b.rl, 3),
      b.depth === null ? null : roundHalfUp(b.depth, 2),
      b.remarks,
    ]);
    used.add(b);
  };

  const total = parsed.structures.length;
  parsed.structures.forEach((s, i) => {
    onProgress(i, total, `Structure ${s.id}`);
    for (const b of parsed.boreholes) {
      if (b.structureId.toUpperCase() === s.id.toUpperCase()) emit(s.id, s.name, b);
    }
  });
  // Boreholes whose Structure_ID is not listed are still exported (and warned
  // about in validation) rather than silently dropped.
  for (const b of parsed.boreholes) if (!used.has(b)) emit(b.structureId, "", b);
  onProgress(total, total, "Done");

  const report = validateBorehole(parsed);
  const tables: OutputTable[] = [{ name: "Coordinates", columns: COORD_COLUMNS, rows }];
  if (report.issues.length > 0) {
    tables.push({
      name: "Checks",
      columns: ["Severity", "Message"],
      rows: report.issues.map((i) => [i.severity, i.message]),
    });
  }
  const { sheets, sketches } = buildReport(parsed);
  if (report.issues.length > 0) {
    sheets.push({
      name: "Checks",
      cells: [
        { r: 1, c: 1, v: "Severity", s: { bold: true } },
        { r: 1, c: 2, v: "Message", s: { bold: true } },
        ...report.issues.flatMap((i, idx) => [
          { r: idx + 2, c: 1, v: i.severity },
          { r: idx + 2, c: 2, v: i.message },
        ]),
      ],
      autoWidth: true,
      freezeRows: 1,
    });
  }
  return {
    tables,
    warnings: report.issues.filter((i) => i.severity !== "info").map((i) => i.message),
    workbook: sheets,
    sketches,
  };
}

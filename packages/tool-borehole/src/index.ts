import type { Tool, ToolManifest } from "@civil/tool-sdk";
import { parseBorehole } from "./parse";
import { runBorehole } from "./run";
import { boreholeTemplate } from "./template";
import type { ParsedBorehole } from "./types";
import { validateBorehole } from "./validate";

export const manifest: ToolManifest = {
  id: "borehole-plan",
  name: "Borehole Coordinates",
  description:
    "Convert borehole chainage and offsets along an alignment into Easting/Northing coordinates, with data checks.",
  category: "Geotechnical",
  icon: "drill",
  version: "0.1.0",
  status: "available",
  execution: "client",
  inputs: [
    {
      id: "master",
      label: "Borehole input workbook",
      description:
        "One workbook with sheets PROJECT_INFO, ALIGNMENT_DATA, STRUCTURES_DATA, BOREHOLES_DATA (or the original sectioned CSV).",
      required: true,
      accept: [".xlsx", ".csv"],
    },
  ],
};

export const tool: Tool<ParsedBorehole> = {
  manifest,
  template: boreholeTemplate,
  parse: parseBorehole,
  validate: validateBorehole,
  run: runBorehole,
};

export * from "./types";
export { boreholeTemplate } from "./template";
export { buildSketch, fmtLen, parseSpans } from "./sketch";
export { buildReport, safeSheetName } from "./workbook";
export { calcBhCoords, isTrialPit } from "./calc";
export { parseBorehole } from "./parse";
export { validateBorehole } from "./validate";
export { runBorehole, COORD_COLUMNS } from "./run";

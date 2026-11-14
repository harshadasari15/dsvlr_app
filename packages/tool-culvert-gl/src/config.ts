/**
 * Constants of CGL_v2.lsp / CGL_v2.bas (v2.5). The two originals keep these
 * identical ("KEEP IDENTICAL"); this port follows them. Drawing-only constants are omitted.
 */
export const CFG = {
  EXT: 15.0, // profile extension beyond each barrel end (m)
  STEP: 2.5, // station interval along culvert axis (m)
  WINX: 5.0, // LGL window half-width along road = span/2 + WINX (m)
  SINK: 0.05, // invert kept below bed level (m)
  SMIN: 0.5, // minimum barrel slope (%)
  SMAX: 2.0, // slope above which outlet protection is flagged (%)
  FLAT: 0.05, // LGL difference below which flow direction is uncertain (m)
  R1: 5.0, // IDW search radii (m)
  R2: 10.0,
  R3: 20.0,
  MINPTS: 3,

  // stream / land
  SSTEP: 5.0,
  REQMIN: 100.0,
  USFACT: 1.5,
  DSFACT: 1.0,
  INTDIV: 10.0,
  INTMIN: 25.0,
  INTMAX: 50.0,
  CSWMARG: 10.0,
  CSWFACT: 1.5,
  CSN: 10,
  CLWARN: 20.0,
  LHALF: 60.0,
  LSTEP: 10.0,
  LFLAT: 15.0,
  LGRADE: 2.5,
  LDECK: 0.45,
  LWC: 0.075,
  LCAMBER: 0.0,
  LALLOW: 0.0,
  GAPMAX: 15.0,
  SCANMAX: 500.0,
} as const;

/** Minimum vertical clearance by land-structure type (m). */
export const CLEARANCE: Record<string, number> = {
  PUP: 3.0,
  CUP: 3.0,
  "PUP/CUP": 3.0,
  LVUP: 4.0,
  SVUP: 4.0,
  VUP: 5.5,
  FO: 5.5,
  ROB: 6.525,
};

export const STREAM_TYPES = ["STREAM", "MNB", "BRIDGE"];

export type Kind = "LAND" | "STREAM" | "CULVERT";

export function kindOf(type: string): Kind {
  if (CLEARANCE[type] !== undefined) return "LAND";
  return STREAM_TYPES.includes(type) ? "STREAM" : "CULVERT";
}

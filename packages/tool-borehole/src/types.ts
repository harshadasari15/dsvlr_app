import type { ValidationIssue } from "@civil/tool-sdk";

export interface AlignPoint {
  ch: number;
  e: number;
  n: number;
  remarks: string;
}

export interface Structure {
  id: string;
  type: string;
  name: string;
  ch: number | null;
  /** Raw span arrangement text, e.g. "15+30+15" or "3x35". */
  spans: string;
  skew: number; // degrees, absolute
  skewDir: string; // CW | CCW | NONE
  widthL: number; // metres, > 0
  widthR: number;
  crossing: string;
  refCh: number;
}

export interface Borehole {
  structureId: string;
  bhNo: string;
  member: string;
  ch: number;
  offset: number;
  side: "LHS" | "RHS";
  rl: number | null;
  depth: number | null;
  remarks: string;
}

export interface ParsedBorehole {
  projectInfo: Record<string, string>;
  alignment: AlignPoint[]; // sorted by chainage
  structures: Structure[];
  boreholes: Borehole[];
  /** Problems found while reading (bad numbers, short rows, ...). */
  parseIssues: ValidationIssue[];
}

import type { ValidationIssue } from "@civil/tool-sdk";
import type { AlignRow, Pt } from "./geometry";

/** One row of the structure file (CGL:READSTRUCT). */
export interface StructRow {
  sno: number;
  ch: number;
  span: number;
  len: number;
  skew: number; // degrees
  height: number | null; // drawing only
  clearance: number | null;
  type: string;
  csUs: string;
  csDs: string;
  csWidth: number | null;
  deck: number | null;
  wearing: number | null;
  camber: number | null;
  underRl: number | null;
}

export interface TopoInfo {
  total: number;
  minE: number;
  minN: number;
  maxE: number;
  maxN: number;
}

export interface ParsedCulvert {
  structures: StructRow[];
  alignment: AlignRow[];
  /** Flat [e, n, z, ...] of every valid survey point, file order. */
  topo: Float64Array;
  topoInfo: TopoInfo;
  /** Stream centrelines keyed by S.No. */
  centrelines: Map<number, Pt[]>;
  hasCentrelineFile: boolean;
  fileNames: { structures: string; alignment: string; topo: string };
  parseIssues: ValidationIssue[];
}

export type Prof = [o: number, e: number, n: number, z: number | null, r: number];

/** Culvert / stream-crossing result (CGL:COMPUTE1). */
export interface CulvertRec {
  sno: number;
  ch: number;
  span: number;
  skew: number;
  ls: number;
  half: number;
  E: number;
  N: number;
  brg: number;
  prof: Prof[];
  ae: number;
  an: number;
  loc: Float64Array;
  ok: boolean;
  zcl?: number | null;
  zle?: number | null;
  zre?: number | null;
  lglL?: number;
  dchL?: number;
  offL?: number;
  lglR?: number;
  dchR?: number;
  offR?: number;
  flow?: string;
  ins?: string;
  outs?: string;
  natfall?: number;
  natslope?: number;
  ilin?: number;
  ilout?: number;
  ilL?: number;
  ilR?: number;
  bfall?: number;
  dslope?: number;
  cut?: number;
  maxR: number;
  flags: string;
  kind: "CULVERT" | "STREAM";
  type: string;
  stream?: StreamRec;
}

/** Stream L-section point: [dist, z, t, E, N, r]. */
export type LsPt = [number, number | null, number, number, number, number];
/** Stream cross-section point: [station, desc, offset, E, N, z, r]. */
export type CsPt = [number, string, number, number, number, number | null, number];

export interface StreamRec {
  ok: boolean;
  mode: string;
  basis: string;
  ureq: number;
  dreq: number;
  hw: number;
  flags: string;
  ls?: LsPt[];
  cs?: CsPt[];
  sds?: number;
  sus?: number;
  div?: number | null;
  uiv?: number | null;
  bds?: number | null;
  bus?: number | null;
  fall?: number | null;
  slope?: number | null;
  ncs?: number;
}

export type LandProf = [dch: number, e: number, n: number, z: number | null, frl: number | null, fill: number | null, r: number];

export interface LandRec {
  kind: "LAND";
  sno: number;
  ch: number;
  span: number;
  type: string;
  E: number;
  N: number;
  ok: boolean;
  glref: number | null;
  oref: number | null;
  dref: number | null;
  clr: number | undefined;
  under: number | null;
  src: string;
  deck: number;
  wc: number;
  cam: number;
  soffit: number | null;
  frl: number | null;
  maxR: number;
  prof: LandProf[];
  flags: string;
}

export type StructRec = CulvertRec | LandRec;

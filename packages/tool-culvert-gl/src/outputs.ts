import type { OutputTable } from "@civil/tool-sdk";
import { chFmt, rndOrNull } from "./numeric";
import type { CulvertRec, LandRec, StructRec } from "./types";

type Row = (string | number | null)[];

export const SUMMARY_COLUMNS = [
  "SNo", "Chainage", "ChFmt", "Span", "Skew_deg", "BarrelLen", "Easting", "Northing", "Bearing_deg",
  "GL_CL", "GL_LeftEnd", "GL_RightEnd", "LGL_Left", "LGL_L_dCh", "LGL_L_Off", "LGL_Right", "LGL_R_dCh", "LGL_R_Off",
  "Flow", "InletSide", "OutletSide", "NatBedFall", "NatBedSlope_pct", "IL_Inlet", "IL_Outlet", "IL_Left", "IL_Right",
  "BarrelFall", "DesignSlope_pct", "OutfallCut", "MaxSearchR", "Flags",
];
export const PROFILE_COLUMNS = ["SNo", "Offset", "Easting", "Northing", "GL", "SearchR"];
export const STREAM_SUMMARY_COLUMNS = [
  "SNo", "Chainage", "ChFmt", "Flow", "Mode", "CS_Basis", "Req_DS", "Req_US", "Surveyed_DS", "Surveyed_US",
  "CS_Int_DS", "CS_Int_US", "Bed_DS", "Bed_US", "BedFall", "BedSlope_pct", "CS_Count", "Flags",
];
export const STREAM_LS_COLUMNS = ["SNo", "Dist", "dT", "Easting", "Northing", "BedLevel", "SearchR"];
export const STREAM_CS_COLUMNS = ["SNo", "Station", "Desc", "Offset", "Easting", "Northing", "GL", "SearchR"];
export const LAND_SUMMARY_COLUMNS = [
  "SNo", "Chainage", "ChFmt", "Type", "Span", "Easting", "Northing", "Max_GL", "MaxGL_Off", "MaxGL_dCh", "Under_RL",
  "Ref_Source", "Clearance", "Soffit", "DeckDepth", "WearingCoat", "Camber", "FRL_Min", "MaxSearchR", "Flags",
];
export const LAND_PROFILE_COLUMNS = ["SNo", "dCh", "Easting", "Northing", "GL", "FRL", "Fill", "SearchR"];

const r3 = (x: number | null | undefined) => rndOrNull(x, 3);
const r1 = (x: number | null | undefined) => rndOrNull(x, 1);

function summaryRow(r: CulvertRec): Row {
  const base: Row = [r.sno, r3(r.ch), chFmt(r.ch), r3(r.span), r3(r.skew), r3(r.ls), r3(r.E), r3(r.N), rndOrNull(r.brg, 4)];
  if (r.ok) {
    base.push(
      r3(r.zcl), r3(r.zle), r3(r.zre), r3(r.lglL), r3(r.dchL), r3(r.offL), r3(r.lglR), r3(r.dchR), r3(r.offR),
      r.flow ?? null, r.ins ?? null, r.outs ?? null,
      r3(r.natfall), r3(r.natslope), r3(r.ilin), r3(r.ilout), r3(r.ilL), r3(r.ilR), r3(r.bfall), r3(r.dslope), r3(r.cut),
    );
  } else {
    for (let i = 0; i < 21; i++) base.push(null);
  }
  base.push(r1(r.maxR), r.flags);
  return base;
}

function streamSummaryRow(r: CulvertRec): Row {
  const s = r.stream!;
  if (s.ok) {
    return [
      r.sno, r3(r.ch), chFmt(r.ch), r.flow ?? null, s.mode, s.basis, r3(s.dreq), r3(s.ureq), r3(s.sds), r3(s.sus),
      r3(s.div), r3(s.uiv), r3(s.bds), r3(s.bus), r3(s.fall), r3(s.slope), s.ncs ?? 0, s.flags,
    ];
  }
  return [
    r.sno, r3(r.ch), chFmt(r.ch), r.flow ?? null, s.mode, s.basis, r3(s.dreq), r3(s.ureq),
    null, null, null, null, null, null, null, null, 0, s.flags,
  ];
}

function landSummaryRow(r: LandRec): Row {
  return [
    r.sno, r3(r.ch), chFmt(r.ch), r.type, r3(r.span), r3(r.E), r3(r.N), r3(r.glref), r3(r.oref), r3(r.dref),
    r3(r.under), r.src, r3(r.clr), r3(r.soffit), r3(r.deck), r3(r.wc), r3(r.cam), r3(r.frl), r1(r.maxR), r.flags,
  ];
}

/** The seven output tables of CGL_v2 (CGL:OUTPUTS); tables without data rows are left out. */
export function buildTables(res: StructRec[]): OutputTable[] {
  const culvert: Row[] = [];
  const culvertProf: Row[] = [];
  const streamSum: Row[] = [];
  const streamLs: Row[] = [];
  const streamCs: Row[] = [];
  const landSum: Row[] = [];
  const landProf: Row[] = [];

  for (const r of res) {
    if (r.kind === "LAND") {
      landSum.push(landSummaryRow(r));
      for (const p of r.prof) landProf.push([r.sno, r3(p[0]), r3(p[1]), r3(p[2]), r3(p[3]), r3(p[4]), r3(p[5]), r1(p[6])]);
      continue;
    }
    culvert.push(summaryRow(r));
    for (const p of r.prof) culvertProf.push([r.sno, r3(p[0]), r3(p[1]), r3(p[2]), r3(p[3]), r1(p[4])]);
    if (r.kind === "STREAM" && r.stream) {
      streamSum.push(streamSummaryRow(r));
      if (r.stream.ok) {
        for (const p of r.stream.ls ?? []) streamLs.push([r.sno, r3(p[0]), r3(p[2]), r3(p[3]), r3(p[4]), r3(p[1]), r1(p[5])]);
        for (const p of r.stream.cs ?? []) streamCs.push([r.sno, r3(p[0]), p[1], r3(p[2]), r3(p[3]), r3(p[4]), r3(p[5]), r1(p[6])]);
      }
    }
  }

  const all: [string, string[], Row[]][] = [
    ["Culvert_GL_Summary", SUMMARY_COLUMNS, culvert],
    ["Culvert_GL_Profiles", PROFILE_COLUMNS, culvertProf],
    ["Stream_Summary", STREAM_SUMMARY_COLUMNS, streamSum],
    ["Stream_LS", STREAM_LS_COLUMNS, streamLs],
    ["Stream_CS", STREAM_CS_COLUMNS, streamCs],
    ["Land_Summary", LAND_SUMMARY_COLUMNS, landSum],
    ["Land_Profiles", LAND_PROFILE_COLUMNS, landProf],
  ];
  return all.filter(([, , rows]) => rows.length > 0).map(([name, columns, rows]) => ({ name, columns, rows }));
}

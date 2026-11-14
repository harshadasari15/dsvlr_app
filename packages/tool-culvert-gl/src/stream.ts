import { CFG } from "./config";
import { idw, near, plCum, plPoint, plProj, type Pt } from "./geometry";
import { fmt, rnd } from "./numeric";
import { autoList, sGrid, streamPlan, type SideMode } from "./plan";
import type { CsPt, CulvertRec, LsPt, StreamRec, StructRow } from "./types";

type Frame =
  | { mode: "STRAIGHT"; E: number; N: number; cupE: number; cupN: number }
  | { mode: "CENTRELINE"; cl: Pt[]; cum: number[]; s0: number; sgn: number };

/** Station frame -> [pE, pN, upE, upN, extrapolated] (CGL:FRAME). */
function frameAt(fr: Frame, sv: number): [number, number, number, number, boolean] {
  if (fr.mode === "STRAIGHT") return [fr.E + sv * fr.cupE, fr.N + sv * fr.cupN, fr.cupE, fr.cupN, false];
  const p = plPoint(fr.cl, fr.cum, fr.s0 + fr.sgn * sv);
  return [p[0], p[1], fr.sgn * p[2], fr.sgn * p[3], p[4]];
}

/** Bed at a station: [z, t, E, N, r, extrapolated] (CGL:BED). */
type Bed = [number | null, number, number, number, number, boolean];

function bedAt(fr: Frame, sv: number, tlist: number[], loc: Float64Array): Bed {
  const f = frameAt(fr, sv);
  const nE = -f[3];
  const nN = f[2];
  const tmax = Math.max(Math.abs(tlist[0]!), Math.abs(tlist[tlist.length - 1]!));
  const sub = near(loc, f[0], f[1], CFG.R3 + tmax + 0.001);
  let best: [number, number, number, number, number] | null = null;
  let bestx: [number, number, number, number, number] | null = null;
  for (const tt of tlist) {
    const pe = f[0] + tt * nE;
    const pn = f[1] + tt * nN;
    const [z, r] = idw(sub, pe, pn);
    if (z !== null) {
      const rz = rnd(z, 3);
      if (r <= CFG.R2) {
        if (best === null || rz < best[0]) best = [rz, tt, pe, pn, r];
      }
      if (bestx === null || rz < bestx[0]) bestx = [rz, tt, pe, pn, r];
    }
  }
  const res = best ?? bestx ?? ([null, 0, f[0], f[1], -1.0] as [null, number, number, number, number]);
  return [res[0], res[1], res[2], res[3], res[4], f[4]];
}

const relb = (b: Bed) => b[0] !== null && b[4] <= CFG.R2;

interface Side {
  pts: LsPt[]; // outward, (dist z t E N r)
  surveyed: number;
  csList: number[] | null;
  interval: number | null;
  limit: number;
}

/** One side of the stream (CGL:SIDE); sign -1 = D/S, +1 = U/S. */
function side(
  sign: number,
  m: SideMode,
  tlist: number[],
  loc: Float64Array,
  okx: boolean,
  span: number,
  fr: Frame,
  state: { clext: boolean },
): Side {
  const lim = m.limit;
  let pts: LsPt[] = [];
  let lastd = 0.0;
  if (m.mode === "AUTO") {
    if (okx) {
      const all: LsPt[] = [];
      let go = true;
      for (let k = 1; go && k * CFG.SSTEP <= CFG.SCANMAX + 0.0001; k++) {
        const d = k * CFG.SSTEP;
        const b = bedAt(fr, sign * d, tlist, loc);
        if (b[5]) {
          go = false;
        } else {
          all.push([d, b[0], b[1], b[2], b[3], b[4]]);
          if (relb(b)) lastd = d;
          else if (d - lastd > CFG.GAPMAX + 0.0001) go = false;
        }
      }
      pts = all.filter((p) => p[0] <= lastd + 0.0001);
    }
    const [list, iv] = autoList(lastd, span);
    return { pts, surveyed: lastd, csList: list, interval: iv, limit: lim };
  }

  let stop = !okx;
  for (const d of sGrid(lim)) {
    const b = bedAt(fr, sign * d, tlist, loc);
    if (b[5]) state.clext = true;
    pts.push([d, b[0], b[1], b[2], b[3], b[4]]);
    if (!stop) {
      if (relb(b)) lastd = d;
      else if (d - lastd > CFG.GAPMAX + 0.0001) stop = true;
    }
  }
  let iv: number | null = null;
  if (m.mode === "IRC") {
    iv = span / CFG.INTDIV;
    if (iv < CFG.INTMIN) iv = CFG.INTMIN;
    if (iv > CFG.INTMAX) iv = CFG.INTMAX;
  }
  return { pts, surveyed: lastd, csList: m.list, interval: iv, limit: lim };
}

/** Stream bed profile and cross-sections for a stream crossing (CGL:STREAM). */
export function computeStream(rec: CulvertRec, s: StructRow, cline: Pt[] | undefined): StreamRec {
  const pl = streamPlan(s);
  const mode = cline ? "CENTRELINE" : "STRAIGHT";
  const basis = `${pl.ds.mode}/${pl.us.mode}`;
  if (!rec.ok) {
    return {
      ok: false,
      mode,
      basis,
      ureq: pl.us.limit,
      dreq: pl.ds.limit,
      hw: pl.hw,
      flags: "NO CULVERT RESULT - FLOW DIRECTION UNKNOWN",
    };
  }
  const loc = rec.loc;
  const [cupE, cupN] = rec.ins === "RIGHT" ? [rec.ae, rec.an] : [-rec.ae, -rec.an];
  const flags: string[] = [];
  const state = { clext: false };

  let fr: Frame;
  if (cline) {
    const cum = plCum(cline);
    const [s0, dcl, iseg] = plProj(cline, cum, rec.E, rec.N);
    const segLen = cum[iseg + 1]! - cum[iseg]!;
    const tE = (cline[iseg + 1]![0] - cline[iseg]![0]) / segLen;
    const tN = (cline[iseg + 1]![1] - cline[iseg]![1]) / segLen;
    const sgn = tE * cupE + tN * cupN > 0 ? 1.0 : -1.0;
    if (dcl > CFG.CLWARN) flags.push(`CENTRELINE ${fmt(dcl, 1)} m FROM STRUCTURE - CHECK S.No`);
    fr = { mode: "CENTRELINE", cl: cline, cum, s0, sgn };
  } else {
    fr = { mode: "STRAIGHT", E: rec.E, N: rec.N, cupE, cupN };
  }

  const W = s.span / 2 + CFG.WINX;
  const nd = Math.floor(W / CFG.STEP + 0.0001);
  const tlist: number[] = [];
  for (let k = -nd; k <= nd; k++) tlist.push(k * CFG.STEP);

  const b0 = bedAt(fr, 0.0, tlist, loc);
  const okx = relb(b0);
  if (!okx) flags.push("NO RELIABLE TOPO AT CROSSING");
  const ds = side(-1.0, pl.ds, tlist, loc, okx, s.span, fr, state);
  const us = side(1.0, pl.us, tlist, loc, okx, s.span, fr, state);

  // L-section: far D/S ... crossing ... far U/S.
  const ls: LsPt[] = [];
  for (let i = ds.pts.length - 1; i >= 0; i--) {
    const p = ds.pts[i]!;
    ls.push([-p[0], p[1], p[2], p[3], p[4], p[5]]);
  }
  ls.push([0.0, b0[0], b0[1], b0[2], b0[3], b0[4]]);
  ls.push(...us.pts);

  const sds = ds.surveyed;
  const sus = us.surveyed;
  if (sds < ds.limit - 0.001 || sus < us.limit - 0.001) {
    flags.push(
      `NOTE: SURVEY AVAILABLE ${fmt(sds, 1)} m D/S AND ${fmt(sus, 1)} m U/S - IRC/SPECIFIED ${fmt(ds.limit, 1)} m D/S AND ${fmt(us.limit, 1)} m U/S`,
    );
  }

  let bds: number | null = null;
  let bus: number | null = null;
  let fall: number | null = null;
  let slope: number | null = null;
  if (okx) {
    for (const p of ls) {
      if (bds === null && Math.abs(p[0] - -sds) < 0.0001) bds = p[1];
      if (bus === null && Math.abs(p[0] - sus) < 0.0001) bus = p[1];
    }
    if (bds !== null && bus !== null) {
      fall = rnd(bus - bds, 3);
      slope = sds + sus > 0.0001 ? rnd((fall / (sds + sus)) * 100.0, 3) : null;
      if (fall < 0.0) flags.push("ADVERSE STREAM BED - CHECK FLOW DIRECTION");
    }
  }

  // Cross-sections.
  const dcs = ds.csList ?? [];
  const ucs = us.csList ?? [];
  const cst = [...dcs.map((v) => -v).reverse(), 0.0, ...ucs];
  const cst2: number[] = [];
  for (const v of cst) if (cst2.length === 0 || v - cst2[cst2.length - 1]! > 0.001) cst2.push(v);
  const cstep = pl.hw / CFG.CSN;
  const cs: CsPt[] = [];
  for (const sv of cst2) {
    const desc = sv < -0.0001 ? "D/S" : sv > 0.0001 ? "U/S" : "CROSSING";
    const f = frameAt(fr, sv);
    const nE = -f[3];
    const nN = f[2];
    if (f[4]) state.clext = true;
    const sub = near(loc, f[0], f[1], CFG.R3 + pl.hw + 0.001);
    for (let k = -CFG.CSN; k <= CFG.CSN; k++) {
      const tt = k * cstep;
      const pe = f[0] + tt * nE;
      const pn = f[1] + tt * nN;
      const [z, r] = idw(sub, pe, pn);
      cs.push([sv, desc, tt, pe, pn, z, r]);
    }
  }
  if (state.clext) flags.push("CENTRELINE SHORTER THAN REQUIRED REACH - EXTENDED STRAIGHT");

  return {
    ok: true,
    mode,
    basis,
    ureq: us.limit,
    dreq: ds.limit,
    hw: pl.hw,
    ls,
    cs,
    sds,
    sus,
    div: ds.interval,
    uiv: us.interval,
    bds,
    bus,
    fall,
    slope,
    ncs: cst2.length,
    flags: flags.length > 0 ? flags.join("; ") : "OK",
  };
}

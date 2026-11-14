import { CFG, kindOf } from "./config";
import { alignAt, idw, plCum, plProj, stations, type AlignRow, type Pt } from "./geometry";
import { fmt, rnd } from "./numeric";
import { streamPlan } from "./plan";
import type { CulvertRec, Prof, StructRow } from "./types";

/** Half-size of the survey window around a structure (CGL:BOXSIZE). */
export function boxSize(s: StructRow, half: number, E: number, N: number, cline: Pt[] | undefined): number {
  const kind = kindOf(s.type);
  const W = s.span / 2 + CFG.WINX;
  if (kind === "STREAM") {
    const pl = streamPlan(s);
    const a = pl.us.mode === "AUTO" ? CFG.SCANMAX : pl.us.limit;
    const b = pl.ds.mode === "AUTO" ? CFG.SCANMAX : pl.ds.limit;
    const reach = a > b ? a : b;
    const wid = pl.hw > W ? pl.hw : W;
    let extra = 0;
    if (cline) {
      const cum = plCum(cline);
      extra = plProj(cline, cum, E, N)[1];
    }
    const x = half + CFG.EXT + W;
    const y = reach + extra + wid;
    return (x > y ? x : y) + CFG.R3 + 1;
  }
  if (kind === "LAND") return Math.max(half + s.span / 2, CFG.LHALF) + CFG.R3 + 1;
  return half + CFG.EXT + W + CFG.R3 + 1;
}

/** Survey points inside the structure window, file order kept. */
export function windowPoints(topo: Float64Array, E: number, N: number, B: number): Float64Array {
  const out: number[] = [];
  for (let i = 0; i < topo.length; i += 3) {
    if (Math.abs(topo[i]! - E) <= B && Math.abs(topo[i + 1]! - N) <= B) out.push(topo[i]!, topo[i + 1]!, topo[i + 2]!);
  }
  return Float64Array.from(out);
}

type ZoneHit = [z: number, d: number, o: number, r: number];
type CacheRow = [o: number, d: number, z: number | null, r: number];

/** Lowest point of an approach zone (CGL:ZONE). side -1 = left, 1 = right; strict = only SearchR <= R2. */
function zone(cache: CacheRow[], half: number, side: number, strict: boolean): ZoneHit | null {
  let best: ZoneHit | null = null;
  for (const [o, d, zv, rv] of cache) {
    const inZone = side < 0 ? o <= -half + 0.0001 : o >= half - 0.0001;
    if (inZone && zv !== null && (!strict || rv <= CFG.R2)) {
      const zr = rnd(zv, 3);
      if (best === null || zr < best[0]) best = [zr, d, o, rv];
    }
  }
  return best;
}

/** Culvert / stream-crossing computation for one structure (CGL:COMPUTE1). */
export function computeCulvert(s: StructRow, al: AlignRow[], topo: Float64Array, cline: Pt[] | undefined): CulvertRec {
  const ag = alignAt(al, s.ch);
  const { E, N, ue, un, brg } = ag;
  const re = un;
  const rn = -ue;
  let c = 1.0;
  let sn = 0.0;
  if (s.skew !== 0) {
    c = Math.cos(s.skew * (Math.PI / 180));
    sn = Math.sin(s.skew * (Math.PI / 180));
  }
  const ae = re * c - rn * sn;
  const an = re * sn + rn * c;
  const Ls = s.len / c;
  const half = Ls / 2;
  const W = s.span / 2 + CFG.WINX;
  const B = boxSize(s, half, E, N, cline);
  const loc = windowPoints(topo, E, N, B);
  const flags: string[] = [];
  if (ag.ext) flags.push("CHAINAGE OUTSIDE ALIGNMENT FILE - LOCATION EXTRAPOLATED");

  // Profile along the axis.
  const sts = stations(half);
  const prof: Prof[] = [];
  for (const o of sts) {
    const pe = E + o * ae + 0.0 * ue;
    const pn = N + o * an + 0.0 * un;
    const [z, r] = idw(loc, pe, pn);
    prof.push([o, pe, pn, z, r]);
  }

  // LGL search grid (approach zones), computed once.
  const nd = Math.floor(W / CFG.STEP + 0.0001);
  const dlist: number[] = [];
  for (let k = -nd; k <= nd; k++) dlist.push(k * CFG.STEP);
  const cache: CacheRow[] = [];
  for (const o of sts) {
    if (o <= -half + 0.0001 || o >= half - 0.0001) {
      for (const d of dlist) {
        const pe = E + o * ae + d * ue;
        const pn = N + o * an + d * un;
        const [z, r] = idw(loc, pe, pn);
        cache.push([o, d, z, r]);
      }
    }
  }
  let bl = zone(cache, half, -1, true);
  if (bl === null) {
    bl = zone(cache, half, -1, false);
    if (bl) flags.push("LEFT LGL FROM EXTRAPOLATED TOPO");
  }
  let br = zone(cache, half, 1, true);
  if (br === null) {
    br = zone(cache, half, 1, false);
    if (br) flags.push("RIGHT LGL FROM EXTRAPOLATED TOPO");
  }

  // Data quality.
  let maxR = 0.0;
  let nodata = false;
  for (const p of prof) {
    if (p[0] >= -half - 0.0001 && p[0] <= half + 0.0001) {
      if (p[3] === null) nodata = true;
      else if (p[4] > maxR) maxR = p[4];
    }
  }
  for (const bz of [bl, br]) if (bz && bz[3] > maxR) maxR = bz[3];

  let zcl: number | null | undefined;
  let zle: number | null | undefined;
  let zre: number | null | undefined;
  for (const p of prof) {
    if (zcl === undefined && Math.abs(p[0]) < 0.0001) zcl = p[3];
    if (zle === undefined && Math.abs(p[0] + half) < 0.0001) zle = p[3];
    if (zre === undefined && Math.abs(p[0] - half) < 0.0001) zre = p[3];
  }

  const rec: CulvertRec = {
    sno: s.sno,
    ch: s.ch,
    span: s.span,
    skew: s.skew,
    ls: Ls,
    half,
    E,
    N,
    brg,
    prof,
    ae,
    an,
    loc,
    ok: false,
    maxR: 0,
    flags: "",
    kind: kindOf(s.type) === "STREAM" ? "STREAM" : "CULVERT",
    type: s.type,
  };

  if (nodata || bl === null || br === null || zcl == null || zle == null || zre == null) {
    flags.push("NO TOPO DATA WITHIN 20 m - SURVEY REQUIRED");
  } else {
    const [lglL, dchL, offL] = bl;
    const [lglR, dchR, offR] = br;
    let flow: string, ins: string, outs: string;
    let lin: number, lout: number, oin: number, din: number, oout: number, dout: number;
    if (lglL >= lglR) {
      flow = "Left to Right"; ins = "LEFT"; outs = "RIGHT";
      lin = lglL; lout = lglR; oin = offL; din = dchL; oout = offR; dout = dchR;
    } else {
      flow = "Right to Left"; ins = "RIGHT"; outs = "LEFT";
      lin = lglR; lout = lglL; oin = offR; din = dchR; oout = offL; dout = dchL;
    }
    if (lglL - lglR < CFG.FLAT && lglR - lglL < CFG.FLAT) {
      flags.push("FLAT GROUND - FLOW DIRECTION UNCERTAIN - VERIFY ON SITE");
    }
    const natfall = rnd(lin - lout, 3);
    const dist = Math.sqrt((oin - oout) * (oin - oout) + (din - dout) * (din - dout));
    const natslope = rnd((natfall / dist) * 100.0, 3);
    const dslope = natslope < CFG.SMIN ? CFG.SMIN : natslope;
    const ilin = rnd(lin - CFG.SINK, 3);
    const ilout = rnd(ilin - (dslope / 100.0) * Ls, 3);
    const bfall = rnd(ilin - ilout, 3);
    let cut = rnd(lout - CFG.SINK - ilout, 3);
    if (cut > 0.0005) flags.push(`MIN SLOPE APPLIED - OUTFALL CHANNEL CUT ${fmt(cut, 3)} m`);
    else cut = 0.0;
    if (dslope > CFG.SMAX) flags.push(`STEEP BARREL > ${fmt(CFG.SMAX, 1)}% - CHECK OUTLET VELOCITY / PROVIDE APRON`);
    if (zcl < ilout) flags.push("CL GROUND BELOW OUTLET INVERT - CHECK CULVERT LOCATION");
    const [ilL, ilR] = ins === "LEFT" ? [ilin, ilout] : [ilout, ilin];
    Object.assign(rec, {
      ok: true, zcl, zle, zre, lglL, dchL, offL, lglR, dchR, offR, flow, ins, outs,
      natfall, natslope, ilin, ilout, ilL, ilR, bfall, dslope, cut,
    });
  }
  if (!nodata) {
    if (maxR >= 99.0) flags.push("SPARSE TOPO (<3 PTS IN 20 m)");
    else if (maxR >= CFG.R3) flags.push("SPARSE TOPO (20 m SEARCH USED)");
  }
  rec.maxR = maxR;
  rec.flags = flags.length > 0 ? flags.join("; ") : "OK";
  // zcl/zle/zre may be null (no data) even when not ok.
  if (!rec.ok) Object.assign(rec, { zcl, zle, zre });
  return rec;
}


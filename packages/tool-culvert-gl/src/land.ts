import { CFG, CLEARANCE } from "./config";
import { boxSize, windowPoints } from "./culvert";
import { alignAt, idw, symList, type AlignRow } from "./geometry";
import { fmt, rnd } from "./numeric";
import type { LandProf, LandRec, StructRow } from "./types";

type CacheRow = [o: number, d: number, z: number | null, r: number];

/** Highest reliable ground in the footprint (CGL:LANDPICK): [z, o, d, r]. */
function landPick(cache: CacheRow[], strict: boolean): [number, number, number, number] | null {
  let best: [number, number, number, number] | null = null;
  for (const [o, d, z, r] of cache) {
    if (z !== null && (!strict || r <= CFG.R2)) {
      const rz = rnd(z, 3);
      if (best === null || rz > best[0]) best = [rz, o, d, r];
    }
  }
  return best;
}

/** Land structure (PUP/CUP, LVUP, SVUP, VUP, FO, ROB): soffit, minimum FRL and highway profile (CGL:LAND). */
export function computeLand(s: StructRow, al: AlignRow[], topo: Float64Array): LandRec {
  const ag = alignAt(al, s.ch);
  const { E, N, ue, un } = ag;
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
  const B = boxSize(s, half, E, N, undefined);
  const loc = windowPoints(topo, E, N, B);
  const flags: string[] = [];
  if (ag.ext) flags.push("CHAINAGE OUTSIDE ALIGNMENT FILE - LOCATION EXTRAPOLATED");

  // Reference (highest) ground within the structure footprint.
  const olist = symList(half);
  const dlist = symList(s.span / 2);
  const cache: CacheRow[] = [];
  for (const o of olist) {
    for (const d of dlist) {
      const pe = E + o * ae + d * ue;
      const pn = N + o * an + d * un;
      const [z, r] = idw(loc, pe, pn);
      cache.push([o, d, z, r]);
    }
  }
  let best = landPick(cache, true);
  if (best === null) {
    best = landPick(cache, false);
    if (best) flags.push("REF GL FROM EXTRAPOLATED TOPO");
  }

  const clr = s.clearance !== null ? s.clearance : CLEARANCE[s.type];
  const deck = s.deck !== null ? s.deck : CFG.LDECK;
  const wc = s.wearing !== null ? s.wearing : CFG.LWC;
  const cam = s.camber !== null ? s.camber : CFG.LCAMBER;
  const under = s.underRl;
  let src = "";
  let ref: number | null = null;
  let maxR = 0.0;
  let glref: number | null = null;
  let oref: number | null = null;
  let dref: number | null = null;
  if (best === null) {
    flags.push("NO TOPO DATA WITHIN 20 m - SURVEY REQUIRED");
  } else {
    [glref, oref, dref] = best;
    maxR = best[3];
  }

  // Reference level for clearance: finished cross-road / rail level if given, else the highest existing ground.
  if (under !== null) {
    ref = under;
    src = "UNDER_RL";
    if (best !== null && glref !== null && under < glref - 0.0005) {
      flags.push(`UNDER_RL ${fmt(glref - under, 3)} m BELOW MAX GL - CUTTING UNDER STRUCTURE`);
    }
  } else if (best !== null && glref !== null) {
    ref = glref + CFG.LALLOW;
    src = "MAX_GL";
  }

  let ok = false;
  let soffit: number | null = null;
  let frl: number | null = null;
  if (ref !== null && clr !== undefined) {
    ok = true;
    soffit = rnd(ref + clr, 3);
    frl = rnd(soffit + deck + wc + cam, 3);
  }

  // Highway profile along the alignment.
  const prof: LandProf[] = [];
  let ext = false;
  const kk = Math.floor(CFG.LHALF / CFG.LSTEP + 0.0001);
  for (let i = -kk; i <= kk; i++) {
    const dch = i * CFG.LSTEP;
    const a2 = alignAt(al, s.ch + dch);
    if (a2.ext) ext = true;
    const [z, r] = idw(loc, a2.E, a2.N);
    let fr: number | null = null;
    let fill: number | null = null;
    if (ok && frl !== null) {
      fr =
        Math.abs(dch) <= CFG.LFLAT + 0.0001
          ? frl
          : rnd(frl - ((Math.abs(dch) - CFG.LFLAT) * CFG.LGRADE) / 100.0, 3);
      fill = z !== null ? rnd(fr - rnd(z, 3), 3) : null;
    }
    prof.push([dch, a2.E, a2.N, z, fr, fill, r]);
  }
  if (ext && !ag.ext) flags.push("PROFILE BEYOND ALIGNMENT FILE - EXTRAPOLATED");

  return {
    kind: "LAND",
    sno: s.sno,
    ch: s.ch,
    span: s.span,
    type: s.type,
    E,
    N,
    ok,
    glref,
    oref,
    dref,
    clr,
    under,
    src,
    deck,
    wc,
    cam,
    soffit,
    frl,
    maxR,
    prof,
    flags: flags.length > 0 ? flags.join("; ") : "OK",
  };
}

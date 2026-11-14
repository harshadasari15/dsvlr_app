import { CFG } from "./config";

export interface AlignRow {
  ch: number;
  e: number;
  n: number;
}

export interface AlignResult {
  E: number;
  N: number;
  ue: number; // unit tangent (easting)
  un: number; // unit tangent (northing)
  brg: number; // degrees, 0..360
  ext: boolean; // chainage outside the alignment file (extrapolated)
}

/** Structure centre E,N and road bearing at a chainage (CGL:ALIGN). */
export function alignAt(al: AlignRow[], ch: number): AlignResult {
  const cnt = al.length;
  let a: AlignRow;
  let b: AlignRow;
  let ext = false;
  if (ch < al[0]!.ch) {
    a = al[0]!;
    b = al[1]!;
    ext = true;
  } else if (ch > al[cnt - 1]!.ch) {
    a = al[cnt - 2]!;
    b = al[cnt - 1]!;
    ext = true;
  } else {
    let i = 0;
    while (i + 2 < cnt && al[i + 1]!.ch < ch) i++;
    a = al[i]!;
    b = al[i + 1]!;
  }
  const dE = b.e - a.e;
  const dN = b.n - a.n;
  const ln = Math.sqrt(dE * dE + dN * dN);
  const tt = (ch - a.ch) / (b.ch - a.ch);
  let brg = Math.atan2(dE, dN) * (180 / Math.PI);
  if (brg < 0) brg += 360;
  return { E: a.e + tt * dE, N: a.n + tt * dN, ue: dE / ln, un: dN / ln, brg, ext };
}

/**
 * Inverse-distance-squared interpolation over a flat [e,n,z, e,n,z, ...] array
 * (CGL:IDW). Returns [z | null, searchRadius]: 0 = exact point, 99 = fewer than
 * MINPTS within R3, -1 = no data.
 */
export function idw(pts: Float64Array, E: number, N: number): [number | null, number] {
  const R3 = CFG.R3;
  const R1s = CFG.R1 * CFG.R1;
  const R2s = CFG.R2 * CFG.R2;
  const R3s = R3 * R3;
  let s1w = 0, s1z = 0, c1 = 0;
  let s2w = 0, s2z = 0, c2 = 0;
  let s3w = 0, s3z = 0, c3 = 0;
  let exs = 0, exn = 0;
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i]! - E;
    if (dx > R3 || dx < -R3) continue;
    const dy = pts[i + 1]! - N;
    if (dy > R3 || dy < -R3) continue;
    const d2 = dx * dx + dy * dy;
    if (d2 > R3s) continue;
    const z = pts[i + 2]!;
    if (d2 < 0.000001) {
      exs += z;
      exn++;
    } else {
      const w = 1.0 / d2;
      s3w += w;
      s3z += w * z;
      c3++;
      if (d2 <= R2s) {
        s2w += w;
        s2z += w * z;
        c2++;
        if (d2 <= R1s) {
          s1w += w;
          s1z += w * z;
          c1++;
        }
      }
    }
  }
  if (exn > 0) return [exs / exn, 0.0];
  if (c1 >= CFG.MINPTS) return [s1z / s1w, CFG.R1];
  if (c2 >= CFG.MINPTS) return [s2z / s2w, CFG.R2];
  if (c3 >= CFG.MINPTS) return [s3z / s3w, CFG.R3];
  if (c3 > 0) return [s3z / s3w, 99.0];
  return [null, -1.0];
}

/** Survey points inside a square of half-size `rad` around E,N, file order kept. */
export function near(pts: Float64Array, E: number, N: number, rad: number): Float64Array {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 3) {
    if (Math.abs(pts[i]! - E) <= rad && Math.abs(pts[i + 1]! - N) <= rad) {
      out.push(pts[i]!, pts[i + 1]!, pts[i + 2]!);
    }
  }
  return Float64Array.from(out);
}

/** Symmetric list k*STEP within +-lim plus +-lim, sorted, de-duplicated (CGL:SYM / CGL:STATIONS core). */
export function symList(lim: number, extra: number[] = []): number[] {
  const lst: number[] = [];
  for (let k = 0; k * CFG.STEP <= lim + 0.0001; k++) {
    lst.push(k * CFG.STEP);
    if (k > 0) lst.push(-(k * CFG.STEP));
  }
  lst.push(lim, -lim, ...extra);
  lst.sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of lst) if (out.length === 0 || v - out[out.length - 1]! > 0.001) out.push(v);
  return out;
}

/** Profile stations along a culvert axis (CGL:STATIONS). */
export function stations(half: number): number[] {
  const lim = half + CFG.EXT;
  // lim is already added by symList; half and -half are the extra stations.
  return symList(lim, [half, -half]);
}

// ---------------------------------------------------------------- polylines

export type Pt = [number, number];

export function plCum(pts: Pt[]): number[] {
  const cum = [0];
  for (let i = 0; i < pts.length - 1; i++) {
    const dE = pts[i + 1]![0] - pts[i]![0];
    const dN = pts[i + 1]![1] - pts[i]![1];
    cum.push(cum[i]! + Math.sqrt(dE * dE + dN * dN));
  }
  return cum;
}

/** Nearest point on a polyline -> [s0 (chainage along line), distance, segment index]. */
export function plProj(pts: Pt[], cum: number[], E: number, N: number): [number, number, number] {
  let best: [number, number, number] | null = null; // d2, i, tt
  for (let i = 0; i < pts.length - 1; i++) {
    const aE = pts[i]![0];
    const aN = pts[i]![1];
    const dE = pts[i + 1]![0] - aE;
    const dN = pts[i + 1]![1] - aN;
    const L2 = dE * dE + dN * dN;
    let tt = ((E - aE) * dE + (N - aN) * dN) / L2;
    if (tt < 0) tt = 0;
    if (tt > 1) tt = 1;
    const qE = aE + tt * dE;
    const qN = aN + tt * dN;
    const d2 = (E - qE) * (E - qE) + (N - qN) * (N - qN);
    if (best === null || d2 < best[0]) best = [d2, i, tt];
  }
  const [d2, i, tt] = best!;
  return [cum[i]! + tt * (cum[i + 1]! - cum[i]!), Math.sqrt(d2), i];
}

/** Point at distance s along a polyline -> [E, N, tE, tN, extrapolated]. */
export function plPoint(pts: Pt[], cum: number[], s: number): [number, number, number, number, boolean] {
  const n = pts.length;
  let i = 0;
  let ext = false;
  if (s < 0) {
    i = 0;
    ext = true;
  } else if (s > cum[n - 1]!) {
    i = n - 2;
    ext = true;
  } else {
    while (i < n - 2 && cum[i + 1]! < s) i++;
  }
  const aE = pts[i]![0];
  const aN = pts[i]![1];
  const dE = pts[i + 1]![0] - aE;
  const dN = pts[i + 1]![1] - aN;
  const ln = cum[i + 1]! - cum[i]!;
  const f = (s - cum[i]!) / ln;
  return [aE + f * dE, aN + f * dN, dE / ln, dN / ln, ext];
}

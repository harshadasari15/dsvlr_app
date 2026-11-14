import type { AlignPoint } from "./types";

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/**
 * Chainage + offset + side -> [Easting, Northing].
 * Port of `bh:calc-bh-coords` (BoreholePlan_v2.lsp). The offset is
 * perpendicular to the PCL; at an alignment vertex the bisector of the two
 * adjoining segments is used. Outside the alignment the end segments are
 * extrapolated. `align` must be sorted by chainage.
 */
export function calcBhCoords(
  ch: number,
  offset: number,
  side: "LHS" | "RHS",
  align: AlignPoint[],
  opts: { vertexBisector?: boolean } = {},
): [number, number] {
  const vertexBisector = opts.vertexBisector ?? true;
  if (align.length < 2) {
    return [500000 + ch, 2500000 + (side === "LHS" ? offset : -offset)];
  }

  let i = 0;
  while (i + 2 < align.length && ch > align[i + 1]!.ch) i++;
  const p1 = align[i]!;
  const p2 = align[i + 1]!;
  const p3 = align[i + 2];

  const ch1 = p1.ch;
  let ch2 = p2.ch;
  if (near(ch1, ch2, 0.0001)) ch2 = ch1 + 1;

  const frac = (ch - ch1) / (ch2 - ch1);
  const eCl = p1.e + frac * (p2.e - p1.e);
  const nCl = p1.n + frac * (p2.n - p1.n);

  let dx = p2.e - p1.e;
  let dy = p2.n - p1.n;
  let segLen = Math.hypot(dx, dy);
  if (segLen < 0.0001) {
    segLen = 1;
    dx = 1;
    dy = 0;
  }
  let ux = dx / segLen;
  let uy = dy / segLen;

  // At a vertex: average incoming and outgoing directions.
  if (vertexBisector && p3 && near(ch, ch2, 0.001)) {
    let vx = p3.e - p2.e;
    let vy = p3.n - p2.n;
    let vlen = Math.hypot(vx, vy);
    if (vlen > 0.0001) {
      vx = ux + vx / vlen;
      vy = uy + vy / vlen;
      vlen = Math.hypot(vx, vy);
      if (vlen > 0.0001) {
        ux = vx / vlen;
        uy = vy / vlen;
      }
    }
  }

  // Left normal = (-uy, ux)
  return side === "LHS"
    ? [eCl - offset * uy, nCl + offset * ux]
    : [eCl + offset * uy, nCl - offset * ux];
}

/** Trial pits are recognised by "TP" in the borehole number. */
export function isTrialPit(bhNo: string): boolean {
  return bhNo.toUpperCase().includes("TP");
}

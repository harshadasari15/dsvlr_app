import { roundHalfUp } from "@civil/core";
import type { Dash, Prim, SketchPreview } from "@civil/tool-sdk";
import { formatChainage } from "@civil/core";
import { isTrialPit } from "./calc";
import type { AlignPoint, Borehole, Structure } from "./types";

/**
 * Port of `DrawSketch` and its helpers from BoreholeSketch_Excel.bas.
 * Sketch units (u along the PCL, v across it) map to points on the sheet.
 */
const SC = 4.2; // points per sketch unit
const X0 = 14; // sketch frame left (points)
const CURVE_MIN_DEFL = 1; // degrees; below this = straight
const MAX_ENLARGE = 2.5;
const U_MAX = 84;
const PI = Math.PI;

const RED = "C00000";
const GREY = "808080";
const GREEN = "008C3C";
const LGREY = "9A9A9A";
const BLUE = "0050C8";
const MAG = "B000B0";
const TEAL = "007C7C";
const DARK = "505050";
const DARK2 = "404040";
const BLACK = "000000";

/** Number to text without needless zeros: 15 -> "15", 12.5 -> "12.5", 9.25 -> "9.25". */
export function fmtLen(v: number): string {
  if (Math.abs(v - Math.round(v)) < 0.001) return String(Math.round(v));
  const s = roundHalfUp(v, 2).toFixed(2);
  return s.endsWith("0") ? s.slice(0, -1) : s;
}

/** "15+30+15" -> [15,30,15]; "3x35" -> [35,35,35]. Invalid parts default to 10 m. */
export function parseSpans(spec: string): number[] {
  const s = spec.toUpperCase().replace(/\s+/g, "");
  const val = (t: string | undefined) => {
    const n = parseFloat(t ?? "");
    return Number.isFinite(n) ? n : 0;
  };
  if (s.includes("X")) {
    const [a, b] = s.split("X");
    let n = Math.round(val(a));
    if (n < 1) n = 1;
    let len = val(b);
    if (len <= 0) len = 10;
    return Array.from({ length: n }, () => len);
  }
  return s.split("+").map((p) => {
    const n = val(p);
    return n <= 0 ? 10 : n;
  });
}

function segIndex(ch: number, a: AlignPoint[]): number {
  let i = 0;
  while (i + 2 < a.length && ch > a[i + 1]!.ch) i++;
  return i;
}

function bearing(ch: number, a: AlignPoint[]): number {
  const i = segIndex(ch, a);
  return Math.atan2(a[i + 1]!.n - a[i]!.n, a[i + 1]!.e - a[i]!.e);
}

export interface SketchResult {
  prims: Prim[];
  width: number;
  height: number;
}

export function buildSketch(
  s: Structure,
  bhs: Borehole[],
  align: AlignPoint[],
  originY: number,
): SketchResult {
  const prims: Prim[] = [];
  const px = (u: number) => X0 + (89 + u) * SC;
  const py = (v: number) => originY + (40 - v) * SC;

  const ln = (u1: number, v1: number, u2: number, v2: number, color: string, w = 0.75, dash: Dash = "solid") =>
    prims.push({ t: "line", x1: px(u1), y1: py(v1), x2: px(u2), y2: py(v2), color, w, dash });
  const poly = (pts: [number, number][], color: string, w: number, dash: Dash) =>
    prims.push({ t: "poly", pts, color, w, dash });
  const rect = (u1: number, v1: number, u2: number, v2: number, color: string, lw: number) =>
    prims.push({ t: "rect", x: px(u1), y: py(v1), w: px(u2) - px(u1), h: py(v2) - py(v1), color, lw });
  const circ = (x: number, y: number, r: number, color: string, lw: number) =>
    prims.push({ t: "ellipse", cx: x, cy: y, r, color, lw });
  const txt = (
    u: number,
    v: number,
    text: string,
    size: number,
    h: "L" | "C" | "R" = "C",
    vv: "T" | "M" | "B" = "M",
    rot = 0,
    color = BLACK,
    bold = false,
  ) => {
    if (text.length === 0) return;
    prims.push({ t: "text", x: px(u), y: py(v), text, size, h, v: vv, rot, color, bold });
  };

  // Borehole symbol: two circles + cross-hair. Trial pit: square + cross-hair.
  const bh = (u: number, v: number, r: number, color: string) => {
    circ(px(u), py(v), r * SC, color, 1);
    circ(px(u), py(v), (r * SC) / 2.2, color, 0.75);
    ln(u - 1.4 * r, v, u + 1.4 * r, v, color, 0.5);
    ln(u, v - 1.4 * r, u, v + 1.4 * r, color, 0.5);
  };
  const sq = (u: number, v: number, r: number, color: string) => {
    rect(u - r, v + r, u + r, v - r, color, 1);
    ln(u - r, v, u + r, v, color, 0.5);
    ln(u, v - r, u, v + r, color, 0.5);
  };
  const dimH = (u1: number, u2: number, v0: number, v: number, t: string, color: string) => {
    ln(u1, v0, u1, v - 1.5, color, 0.5);
    ln(u2, v0, u2, v - 1.5, color, 0.5);
    ln(u1, v, u2, v, color, 0.5);
    ln(u1 - 0.8, v - 0.8, u1 + 0.8, v + 0.8, color, 0.5);
    ln(u2 - 0.8, v - 0.8, u2 + 0.8, v + 0.8, color, 0.5);
    txt((u1 + u2) / 2, v + 0.5, t, 7, "C", "B", 0, color);
  };
  const dimV = (u: number, v1: number, v2: number, t: string, color: string) => {
    const x = u - 2;
    ln(u, v1, x - 1.5, v1, color, 0.5);
    ln(u, v2, x - 1.5, v2, color, 0.5);
    ln(x, v1, x, v2, color, 0.5);
    ln(x - 0.8, v1 - 0.8, x + 0.8, v1 + 0.8, color, 0.5);
    ln(x - 0.8, v2 - 0.8, x + 0.8, v2 + 0.8, color, 0.5);
    txt(x - 0.6, (v1 + v2) / 2, t, 7, "C", "B", 270, color);
  };

  const wl = s.widthL;
  const wr = s.widthR;
  const ch0 = s.ch ?? 0;

  const sp = parseSpans(s.spans);
  const ns = sp.length;
  const total = sp.reduce((a, b) => a + b, 0);
  const maxSp = Math.max(...sp);

  // Fit scale: span, every BH/TP and the reference chainage.
  let ext = total / 2;
  for (const b of bhs) ext = Math.max(ext, Math.abs(b.ch - ch0));
  ext = Math.max(ext, Math.abs(s.refCh - ch0)) + 4;
  let sc2 = 76 / (ext < 1 ? 1 : ext);
  if (sc2 > MAX_ENLARGE) sc2 = MAX_ENLARGE;

  // Curvature of the alignment around the structure.
  const hh = Math.max(total / 2, 30);
  let d = bearing(ch0 + hh, align) - bearing(ch0 - hh, align);
  while (d > PI) d -= 2 * PI;
  while (d < -PI) d += 2 * PI;
  const deg = (Math.abs(d) * 180) / PI;
  const isCur = deg >= CURVE_MIN_DEFL;
  let rad = 0;
  let cdir = "";
  let M = 0;
  let CS = 0;
  if (isCur) {
    rad = (2 * hh) / Math.abs(d);
    cdir = d > 0 ? "LEFT" : "RIGHT";
    M = (168 / sc2) ** 2 / (8 * (rad < 50 ? 50 : rad));
    if (M > 7.5) M = 7.5;
    CS = cdir === "LEFT" ? -1 : 1;
  }
  const dyC = (u: number) => CS * M * (1 - (u * u) / (U_MAX * U_MAX));
  const alC = (u: number) => Math.atan((-CS * 2 * M * u) / (U_MAX * U_MAX));

  // Frame
  rect(-89, 40, 89, -28, BLACK, 1);

  // PCL and formation edges (polylines)
  const curve = (f: (u: number) => [number, number]) =>
    Array.from({ length: 17 }, (_, k) => {
      const u1 = (k / 16) * 168 - 84;
      const [u, v] = f(u1);
      return [px(u), py(v)] as [number, number];
    });
  poly(curve((u) => [u, dyC(u)]), RED, 1, "lgDashDot");
  poly(curve((u) => [u - wl * Math.sin(alC(u)), dyC(u) + wl * Math.cos(alC(u))]), GREY, 0.75, "dashDot");
  poly(curve((u) => [u + wr * Math.sin(alC(u)), dyC(u) - wr * Math.cos(alC(u))]), GREY, 0.75, "dashDot");
  txt(84, dyC(84) + 0.4, "PCL", 7, "R", "B", 0, RED);

  // Carriageway widths
  dimV(-80, 0, wl, fmtLen(wl), TEAL);
  dimV(-80, -wr, 0, fmtLen(wr), TEAL);
  txt(-76, wl + 1, "LHS", 7, "L", "B");
  txt(-76, -wr - 1, "RHS", 7, "L", "T");

  // Supports
  const pier: number[] = [(-total * sc2) / 2];
  for (let i = 1; i <= ns; i++) pier[i] = pier[i - 1]! + sp[i - 1]! * sc2;
  const th = (s.skew * PI) / 180;
  let rot = 0;
  let kk = 0;
  if (s.skewDir === "CW") {
    rot = -th;
    kk = Math.tan(th);
  } else if (s.skewDir === "CCW") {
    rot = th;
    kk = -Math.tan(th);
  }
  for (let i = 0; i <= ns; i++) {
    const p = pier[i]!;
    const b = PI / 2 + alC(p) + rot;
    ln(p - (wr + 3) * Math.cos(b), dyC(p) - (wr + 3) * Math.sin(b), p + (wl + 3) * Math.cos(b), dyC(p) + (wl + 3) * Math.sin(b), GREEN, 1.75);
  }

  // Crossing feature (same skew as supports)
  const e = 10;
  const crossLine = (x0: number) => ln(x0 - kk * (wr + e), -wr - e, x0 + kk * (wl + e), wl + e, LGREY, 1);
  if (s.type === "MNB" || s.type === "MJB" || s.type === "CULVERT") {
    crossLine(pier[0]! - 5);
    crossLine(pier[ns]! + 5);
    txt(0, wl + e + 1.2, s.crossing, 7.5, "C", "B", 0, DARK);
  } else {
    let rw = 0.7 * maxSp * sc2;
    if (rw > 12) rw = 12;
    crossLine(-rw / 2);
    crossLine(rw / 2);
    txt(kk * (wl + e), wl + e + 1.2, s.crossing, 7.5, "C", "B", 0, DARK);
  }
  if (s.skew > 0) txt(40, wl + 3, `SKEW ${fmtLen(s.skew)}° ${s.skewDir}`, 7.5, "L", "B");

  // Span dimensions
  if (ns <= 6) {
    for (let i = 1; i <= ns; i++) dimH(pier[i - 1]!, pier[i]!, -wr - 2, -wr - 5.5, fmtLen(sp[i - 1]!), TEAL);
  } else {
    dimH(pier[0]!, pier[1]!, -wr - 2, -wr - 5.5, fmtLen(sp[0]!), TEAL);
    dimH(pier[ns - 1]!, pier[ns]!, -wr - 2, -wr - 5.5, fmtLen(sp[ns - 1]!), TEAL);
    const eq = sp.every((x) => Math.abs(x - sp[0]!) <= 0.001);
    dimH(
      pier[0]!,
      pier[ns]!,
      -wr - 7,
      -wr - 11,
      eq ? `${ns} x ${fmtLen(sp[0]!)} = ${fmtLen(total)} m` : `${ns} SPANS, TOTAL ${fmtLen(total)} m`,
      TEAL,
    );
  }

  // Reference chainage marker
  const ru = (s.refCh - ch0) * sc2;
  ln(ru, dyC(ru) - wr - 1, ru, dyC(ru) + wl + 5, TEAL, 0.5);
  ln(ru - 0.8, dyC(ru) + wl + 4.2, ru + 0.8, dyC(ru) + wl + 5.8, TEAL, 0.5);
  txt(ru + 0.8, dyC(ru) + wl + 4.6, `REF. CH. ${formatChainage(s.refCh)}`, 7, "L", "B", 0, TEAL);

  // Boreholes & trial pits
  for (const b of bhs) {
    const u = (b.ch - ch0) * sc2;
    const a = alC(u);
    const sg = b.side === "LHS" ? 1 : -1;
    const x = u - sg * b.offset * Math.sin(a);
    const y = dyC(u) + sg * b.offset * Math.cos(a);
    const tp = isTrialPit(b.bhNo);
    if (tp) sq(x, y, 1.2, MAG);
    else bh(x, y, 1.2, BLUE);
    txt(x, y + (sg > 0 ? 2.2 : -2.4), b.bhNo, 7.5, "C", "M", 0, tp ? MAG : BLUE, true);
    if (!tp && (Math.abs(b.offset - wl) < 0.1 || Math.abs(b.offset - wr) < 0.1)) {
      ln(x, dyC(u), x, y, TEAL, 0.5);
      txt(x - 0.4, (dyC(u) + y) / 2, fmtLen(b.offset), 6.5, "C", "B", 270, TEAL);
    }
  }

  // Badge and scale note
  const badge = isCur
    ? `ALIGNMENT: HORIZONTAL CURVE TO ${cdir} (R APPROX. ${Math.round(rad)} M, DEFLECTION ${deg.toFixed(2)}°)`
    : `ALIGNMENT: STRAIGHT (DEFLECTION ${deg.toFixed(2)}°)`;
  txt(0, 37.5, badge, 8, "C", "M");
  let note = "";
  if (sc2 < 0.99) {
    note = `SPANS: ${s.spans} = ${fmtLen(total)} M  [LONGITUDINAL DISTANCES COMPRESSED 1:${(1 / sc2).toFixed(1)}, NTS]`;
  } else if (sc2 > 1.01) {
    note = `SPANS: ${s.spans}  [LONGITUDINAL DISTANCES ENLARGED x${sc2.toFixed(1)}, NTS]`;
  }
  if (note) txt(0, -26, note, 7, "C", "M", 0, DARK2);

  return { prims, width: X0 + 178 * SC + X0, height: 68 * SC + 2 * 12 };
}

export function toPreview(s: Structure, r: SketchResult, originY: number): SketchPreview {
  // Preview is cropped to the frame: shift prims up so the frame starts near the top-left.
  const dy = originY - 8;
  const shift = (p: Prim): Prim => {
    switch (p.t) {
      case "line":
        return { ...p, y1: p.y1 - dy, y2: p.y2 - dy };
      case "poly":
        return { ...p, pts: p.pts.map(([x, y]) => [x, y - dy] as [number, number]) };
      case "rect":
        return { ...p, y: p.y - dy };
      case "ellipse":
        return { ...p, cy: p.cy - dy };
      case "text":
        return { ...p, y: p.y - dy };
    }
  };
  return {
    name: s.id,
    title: s.name,
    width: r.width,
    height: r.height,
    prims: r.prims.map(shift),
  };
}

import { CFG } from "./config";
import type { StructRow } from "./types";

/** One side of a stream: [mode, explicit list | null, required reach]. */
export interface SideMode {
  mode: "AUTO" | "IRC" | "USER";
  list: number[] | null;
  limit: number;
}

export interface StreamPlan {
  us: SideMode;
  ds: SideMode;
  hw: number; // cross-section half width
}

/** IRC distances: multiples of the interval (L/10 clamped to 25..50 m) up to the reach, plus the reach itself. */
export function defList(reach: number, L: number): number[] {
  let iv = L / CFG.INTDIV;
  if (iv < CFG.INTMIN) iv = CFG.INTMIN;
  if (iv > CFG.INTMAX) iv = CFG.INTMAX;
  const out: number[] = [];
  for (let k = 1; k * iv <= reach + 0.0001; k++) out.push(k * iv);
  if (out.length === 0 || out[out.length - 1]! < reach - 0.001) out.push(reach);
  return out;
}

/** "25;50;100" -> positive numbers in file order. */
export function parseList(s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(";")) {
    const t = part.trim();
    if (t === "") continue;
    const v = Number(t);
    if (Number.isFinite(v) && v > 0) out.push(v);
  }
  return out;
}

export function sideMode(txt: string, L: number, req: number): SideMode {
  const t1 = txt.trim().toUpperCase();
  if (t1 === "" || t1 === "AUTO") return { mode: "AUTO", list: null, limit: req };
  if (t1 === "IRC") {
    const lst = defList(req, L);
    return { mode: "IRC", list: lst, limit: lst[lst.length - 1]! };
  }
  const lst = parseList(txt).sort((a, b) => a - b);
  if (lst.length > 0) return { mode: "USER", list: lst, limit: lst[lst.length - 1]! };
  return { mode: "AUTO", list: null, limit: req };
}

export function streamPlan(s: StructRow): StreamPlan {
  const L = s.span;
  const requs = Math.max(CFG.REQMIN, CFG.USFACT * L);
  const reqds = Math.max(CFG.REQMIN, CFG.DSFACT * L);
  const hw =
    s.csWidth !== null && s.csWidth > 0 ? s.csWidth / 2 : Math.max(L / 2 + CFG.CSWMARG, CFG.CSWFACT * L);
  return { us: sideMode(s.csUs, L, requs), ds: sideMode(s.csDs, L, reqds), hw };
}

/** Automatic cross-section distances within surveyed reach R -> [list, interval]. */
export function autoList(R: number, L: number): [number[] | null, number | null] {
  if (R < 0.001) return [null, null];
  let iv = L / CFG.INTDIV;
  if (iv < CFG.INTMIN) iv = CFG.INTMIN;
  if (iv > CFG.INTMAX) iv = CFG.INTMAX;
  if (iv > R / 2) iv = R / 2;
  iv = Math.floor(iv / CFG.SSTEP + 0.0001) * CFG.SSTEP;
  if (iv < CFG.SSTEP) iv = CFG.SSTEP;
  const out: number[] = [];
  for (let k = 1; k * iv <= R + 0.0001; k++) out.push(k * iv);
  if (out.length === 0 || out[out.length - 1]! < R - 0.001) out.push(R);
  return [out, iv];
}

/** Distances every SSTEP up to `reach` plus the reach itself. */
export function sGrid(reach: number): number[] {
  const out: number[] = [];
  for (let k = 1; k * CFG.SSTEP <= reach + 0.0001; k++) out.push(k * CFG.SSTEP);
  if (out.length === 0 || out[out.length - 1]! < reach - 0.001) out.push(reach);
  return out;
}

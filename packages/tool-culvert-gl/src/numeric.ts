/**
 * Rounding and formatting identical to CGL:RND / CGL:FMT / CGL:CHFMT.
 * Note: half-UP (towards +infinity), unlike core's half-away-from-zero helper.
 */
const factor = (dp: number) => (dp === 1 ? 10 : dp === 3 ? 1000 : dp === 4 ? 10000 : 1);

export const rnd = (x: number, dp: number): number => {
  const f = factor(dp);
  return Math.floor(x * f + 0.5) / f;
};

/** Rounded value for output cells; null stays null. */
export const rndOrNull = (x: number | null | undefined, dp: number): number | null =>
  x === null || x === undefined ? null : rnd(x, dp);

/** Fixed-decimal text; null -> "". */
export const fmt = (x: number | null | undefined, dp: number): string =>
  x === null || x === undefined ? "" : rnd(x, dp).toFixed(dp);

/** 26050 -> "26+050". */
export function chFmt(ch: number): string {
  let km = Math.floor(ch / 1000);
  let m = Math.floor(ch - km * 1000 + 0.5);
  if (m >= 1000) {
    km += 1;
    m -= 1000;
  }
  return `${km}+${String(m).padStart(3, "0")}`;
}

import { roundHalfUp } from "./rounding";

/**
 * Format metres as road chainage: 11530 -> "11+530", 26050 -> "26+050",
 * 11600.375 -> "11+600.375". Whole metres are truncated, the remainder is
 * shown to 3 decimals only when it exceeds 0.0005 (same as the LISP tool).
 */
export function formatChainage(metres: number): string {
  const sign = metres < 0 ? "-" : "";
  const abs = Math.abs(metres);
  let km = Math.floor(abs / 1000);
  let mInt = Math.floor(abs - km * 1000);
  let frac = roundHalfUp(abs - (km * 1000 + mInt), 3);
  if (frac >= 1) {
    frac = 0;
    mInt += 1;
    if (mInt >= 1000) {
      mInt -= 1000;
      km += 1;
    }
  }
  const base = `${sign}${km}+${String(mInt).padStart(3, "0")}`;
  return frac > 0.0005 ? `${base}.${frac.toFixed(3).slice(2)}` : base;
}

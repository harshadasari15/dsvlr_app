/**
 * Round half away from zero to `dp` decimals, avoiding binary-float drift
 * (e.g. 1.0005 -> 1.001, which Math.round(x*1000)/1000 gets wrong).
 * Mirrors the half-up rounding used by the original AutoLISP/VBA tools.
 */
export function roundHalfUp(value: number, dp = 3): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  // Shift via exponent notation so decimal digits stay exact.
  const shifted = Number(`${abs}e${dp}`);
  const rounded = Math.round(shifted);
  return sign * Number(`${rounded}e-${dp}`);
}

/** Round half-up and render with a fixed number of decimals. */
export function formatFixed(value: number, dp = 3): string {
  return roundHalfUp(value, dp).toFixed(dp);
}

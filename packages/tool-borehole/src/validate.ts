import type { ValidationIssue, ValidationReport } from "@civil/tool-sdk";
import { isTrialPit } from "./calc";
import type { ParsedBorehole } from "./types";

/** Port of `bh:validate-data`, plus the hard errors the CAD tool papered over. */
export function validateBorehole(p: ParsedBorehole): ValidationReport {
  const issues: ValidationIssue[] = [...p.parseIssues];
  const add = (severity: ValidationIssue["severity"], message: string) =>
    issues.push({ severity, slot: "master", message });

  if (p.alignment.length < 2) add("error", "ALIGNMENT_DATA needs at least 2 valid points.");
  if (p.boreholes.length === 0) add("error", "BOREHOLES_DATA has no valid rows.");

  const ids = new Set(p.structures.map((s) => s.id.toUpperCase()));
  const chMin = p.alignment[0]?.ch;
  const chMax = p.alignment[p.alignment.length - 1]?.ch;

  for (let i = 1; i < p.alignment.length; i++) {
    if (p.alignment[i]!.ch === p.alignment[i - 1]!.ch) {
      add("warning", `ALIGNMENT_DATA has a duplicate chainage ${p.alignment[i]!.ch}.`);
    }
  }

  for (const b of p.boreholes) {
    const label = `${b.structureId}/${b.bhNo}`;
    if (!ids.has(b.structureId.toUpperCase())) {
      add("warning", `${label}: Structure_ID not found in STRUCTURES_DATA.`);
    }
    if (chMin !== undefined && chMax !== undefined && (b.ch < chMin || b.ch > chMax)) {
      add("warning", `${label}: chainage outside the alignment range (coordinates extrapolated).`);
    }
    if (!isTrialPit(b.bhNo) && (b.rl === null || b.depth === null)) {
      add("warning", `${label}: G.L. or depth is blank.`);
    }
  }

  for (const s of p.structures) {
    const n = p.boreholes.filter((b) => b.structureId.toUpperCase() === s.id.toUpperCase()).length;
    if (n === 0) add("warning", `${s.id}: no boreholes listed.`);
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}

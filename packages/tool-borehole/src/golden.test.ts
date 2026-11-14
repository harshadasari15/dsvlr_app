import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "@civil/core";
import { describe, expect, it } from "vitest";
import { calcBhCoords, parseBorehole, runBorehole, tool, validateBorehole } from "./index";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
// Project data is not committed (see .gitignore); these tests are skipped without it.
const have = existsSync(join(dir, "HIGHWAY_BOREHOLE_INPUT.csv"));
const read = (f: string) => (have ? readFileSync(join(dir, f), "utf8") : "");

const inputFiles = () => ({
  master: { name: "HIGHWAY_BOREHOLE_INPUT.csv", sheets: [{ name: "csv", rows: parseCsv(read("HIGHWAY_BOREHOLE_INPUT.csv")) }] },
});

describe.skipIf(!have)("borehole golden test (HIGHWAY_BOREHOLE_INPUT.csv)", () => {
  const parsed = parseBorehole(inputFiles());

  it("parses the sectioned CSV", () => {
    expect(parsed.alignment).toHaveLength(18);
    expect(parsed.structures).toHaveLength(10);
    expect(parsed.boreholes).toHaveLength(45);
    expect(parsed.parseIssues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("validates without errors", () => {
    expect(validateBorehole(parsed).ok).toBe(true);
  });

  it("matches the reference coordinates output row by row", () => {
    const expected = parseCsv(read("FINAL_BOREHOLE_COORDINATES_OUTPUT.csv")).filter((r) => r.length > 1);
    const header = expected.shift()!;
    const col = (name: string) => header.indexOf(name);

    const result = runBorehole(parsed, {}, () => {});
    const table = result.tables.find((t) => t.name === "Coordinates")!;
    expect(table.rows).toHaveLength(expected.length);

    // The reference file predates fix R16 (bisector at alignment vertices), so
    // the 4 boreholes that sit exactly on a vertex differ by up to ~0.11 m.
    const ON_VERTEX = new Set(["STR-03/BH2", "STR-04/BH1", "STR-05/BH6", "STR-08/BH1"]);

    const num = (s: string | undefined) => (s === undefined || s === "" ? null : Number(s));
    expected.forEach((exp, i) => {
      const row = table.rows[i]!;
      const at = (name: string) => row[table.columns.indexOf(name)];
      const where = `${exp[col("Structure_ID")]}/${exp[col("BH_No")]}`;
      expect(at("Structure_ID"), where).toBe(exp[col("Structure_ID")]);
      expect(at("BH_No"), where).toBe(exp[col("BH_No")]);
      expect(at("Chainage_Formatted"), where).toBe(exp[col("Chainage_Formatted")]);
      expect(at("Side"), where).toBe(exp[col("Side")]);
      expect(at("Ground_Level_RL_m"), where).toBe(num(exp[col("Ground_Level_RL_m")]));
      expect(at("Proposed_Depth_m"), where).toBe(num(exp[col("Proposed_Depth_m")]));
      const dE = (at("Easting_X") as number) - num(exp[col("Easting_X")])!;
      const dN = (at("Northing_Y") as number) - num(exp[col("Northing_Y")])!;
      if (ON_VERTEX.has(where)) {
        expect(Math.hypot(dE, dN), where).toBeLessThan(0.15);
      } else {
        expect(dE, where).toBeCloseTo(0, 6);
        expect(dN, where).toBeCloseTo(0, 6);
      }
    });
  });

  it("legacy mode (no vertex bisector) reproduces the reference exactly", () => {
    const expected = parseCsv(read("FINAL_BOREHOLE_COORDINATES_OUTPUT.csv")).filter((r) => r.length > 1);
    const header = expected.shift()!;
    for (const exp of expected) {
      const b = parsed.boreholes.find((x) => x.structureId === exp[0] && x.bhNo === exp[2])!;
      const [e, n] = calcBhCoords(b.ch, b.offset, b.side, parsed.alignment, { vertexBisector: false });
      expect(Math.round(e * 1000) / 1000, exp[2]).toBe(Number(exp[header.indexOf("Easting_X")]));
      expect(Math.round(n * 1000) / 1000, exp[2]).toBe(Number(exp[header.indexOf("Northing_Y")]));
    }
  });

  it("reports the expected data warnings", () => {
    const report = validateBorehole(parsed);
    const messages = report.issues.map((i) => i.message).join("\n");
    expect(messages).toContain("STR-04/BH1: G.L. or depth is blank");
    expect(messages).not.toContain("STR-09/TP1"); // trial pits are exempt
  });
});

describe("calcBhCoords", () => {
  const align = [
    { ch: 0, e: 0, n: 0, remarks: "" },
    { ch: 100, e: 100, n: 0, remarks: "" },
  ];
  it("puts LHS to the left of travel direction", () => {
    expect(calcBhCoords(50, 5, "LHS", align)).toEqual([50, 5]);
    expect(calcBhCoords(50, 5, "RHS", align)).toEqual([50, -5]);
  });
  it("extrapolates beyond the last point", () => {
    expect(calcBhCoords(150, 0, "LHS", align)).toEqual([150, 0]);
  });
});

describe("tool contract", () => {
  it("exposes manifest + functions", () => {
    expect(tool.manifest.id).toBe("borehole-plan");
  });
  it("reports an error when the file is missing", () => {
    expect(tool.validate(tool.parse({}) as never).ok).toBe(false);
  });
});

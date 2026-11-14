import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "@civil/core";
import { describe, expect, it } from "vitest";
import { parseCulvert, runCulvert, validateCulvert } from "./index";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const have = existsSync(join(dir, "topo.csv")) && existsSync(join(dir, "ref", "Culvert_GL_Summary_REF.csv"));

// Project data is not committed (see .gitignore); these tests are skipped without it.
const load = (f: string) => (have ? readFileSync(join(dir, f), "utf8") : "");
const file = (name: string, text: string) => ({ name, sheets: [{ name: "csv", rows: parseCsv(text) }] });

describe.skipIf(!have)("culvert golden test (v2.5 reference outputs)", () => {
  const parsed = parseCulvert({
    structures: file("structures.csv", load("structures.csv")),
    alignment: file("alignment.csv", load("alignment.csv")),
    topo: file("topo.csv", load("topo.csv")),
  });

  it("parses the inputs", () => {
    expect(parsed.structures).toHaveLength(83);
    expect(parsed.alignment.length).toBeGreaterThan(2000);
    expect(parsed.topoInfo.total).toBe(116927);
    expect(parsed.parseIssues.filter((i) => i.severity === "error")).toEqual([]);
    expect(validateCulvert(parsed).ok).toBe(true);
  });

  const t0 = Date.now();
  const result = runCulvert(parsed, {}, () => {});
  const seconds = (Date.now() - t0) / 1000;

  it("runs in reasonable time", () => {
    expect(seconds).toBeLessThan(60);
  });

  const stems = [
    "Culvert_GL_Summary",
    "Culvert_GL_Profiles",
    "Stream_Summary",
    "Stream_LS",
    "Stream_CS",
    "Land_Summary",
    "Land_Profiles",
  ];

  for (const stem of stems) {
    it(`${stem} matches the reference cell by cell`, () => {
      const ref = parseCsv(load(`ref/${stem}_REF.csv`)).filter((r) => r.length > 1 || (r[0] ?? "") !== "");
      const header = ref.shift()!;
      const table = result.tables.find((t) => t.name === stem)!;
      expect(table, `${stem} missing`).toBeDefined();
      expect(table.columns).toEqual(header);
      expect(table.rows).toHaveLength(ref.length);
      const numeric = /^-?\d+(\.\d+)?$/;
      ref.forEach((refRow, i) => {
        const row = table.rows[i]!;
        refRow.forEach((refCell, j) => {
          const mine = row[j];
          const where = `${stem} row ${i + 2} col ${header[j]}`;
          if (refCell === "") expect(mine ?? null, where).toBeNull();
          else if (numeric.test(refCell)) expect(Number(mine), where).toBeCloseTo(Number(refCell), 9);
          else expect(String(mine), where).toBe(refCell);
        });
      });
    });
  }
});

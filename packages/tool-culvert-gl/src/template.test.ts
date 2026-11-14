import { readFile, writeWorkbook } from "@civil/excel";
import { describe, expect, it } from "vitest";
import { culvertTemplate, parseCulvert, tool } from "./index";

describe("culvert template workbook", () => {
  it("one workbook can feed all slots (sheet picked by slot name)", async () => {
    const loaded = await readFile("template.xlsx", await writeWorkbook(culvertTemplate()));
    expect(loaded.sheets.map((s) => s.name)).toEqual(["Structures", "Alignment", "Topo", "Centreline"]);

    const parsed = parseCulvert({ structures: loaded, alignment: loaded, topo: loaded, centreline: loaded });
    expect(parsed.structures).toHaveLength(2);
    expect(parsed.alignment).toHaveLength(2);
    expect(parsed.topoInfo.total).toBe(2);
    expect(parsed.centrelines.get(2)).toHaveLength(2);

    const report = tool.validate(parsed);
    expect(report.ok).toBe(true);
    const result = await tool.run(parsed, {}, () => {});
    expect(result.tables.find((t) => t.name === "Culvert_GL_Summary")!.rows).toHaveLength(2);
  });

  it("reports missing and unsorted inputs instead of crashing", () => {
    expect(tool.validate(tool.parse({}) as never).ok).toBe(false);
    const parsed = parseCulvert({
      structures: { name: "s", sheets: [{ name: "s", rows: [["S.No", "Chainage", "Span", "Length"], [1, 100, 4, 30]] }] },
      alignment: { name: "a", sheets: [{ name: "a", rows: [["Chainage", "Easting", "Northing"], [200, 1, 1], [100, 2, 2]] }] },
      topo: { name: "t", sheets: [{ name: "t", rows: [["Easting", "Northing", "RL"], [1, 1, 1]] }] },
    });
    const report = tool.validate(parsed);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => /increasing order/.test(i.message))).toBe(true);
  });
});

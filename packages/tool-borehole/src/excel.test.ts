import { describe, expect, it } from "vitest";
import { boreholeTemplate, parseBorehole, tool } from "./index";
import { readFile, tablesToSheets, writeWorkbook } from "@civil/excel";

describe("excel round trip", () => {
  it("writes the template and reads it back into the borehole tool", async () => {
    const buf = await writeWorkbook(boreholeTemplate());
    const loaded = await readFile("template.xlsx", buf);
    expect(loaded.sheets.map((s) => s.name)).toEqual([
      "PROJECT_INFO",
      "ALIGNMENT_DATA",
      "STRUCTURES_DATA",
      "BOREHOLES_DATA",
    ]);
    const parsed = parseBorehole({ master: loaded });
    expect(parsed.alignment).toHaveLength(3);
    expect(parsed.boreholes).toHaveLength(2);
    expect(parsed.parseIssues).toEqual([]);
  });

  it("produces an output workbook with a Coordinates sheet", async () => {
    const loaded = await readFile("t.xlsx", await writeWorkbook(boreholeTemplate()));
    const parsed = parseBorehole({ master: loaded });
    expect(tool.validate(parsed).ok).toBe(true);
    const result = await tool.run(parsed, {}, () => {});
    const out = await readFile("out.xlsx", await writeWorkbook(tablesToSheets(result.tables)));
    const sheet = out.sheets.find((s) => s.name === "Coordinates")!;
    expect(sheet.rows[0]![0]).toBe("Structure_ID");
    expect(sheet.rows).toHaveLength(3);
    expect(typeof sheet.rows[1]![8]).toBe("number");
  });

  it("rejects unsupported file types", async () => {
    await expect(readFile("a.pdf", new ArrayBuffer(1))).rejects.toThrow(/Unsupported/);
  });
});

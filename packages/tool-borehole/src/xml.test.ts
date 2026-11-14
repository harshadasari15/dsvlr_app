import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "@civil/core";
import { writeReport } from "@civil/excel";
import JSZip from "jszip";
import { SaxesParser } from "saxes";
import { describe, expect, it } from "vitest";
import { parseBorehole, runBorehole } from "./index";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function assertWellFormed(name: string, xml: string) {
  const p = new SaxesParser({ xmlns: true });
  let err: Error | undefined;
  p.on("error", (e) => (err ??= e));
  p.write(xml).close();
  expect(err, `${name}: ${err?.message}`).toBeUndefined();
}

// Project data is not committed (see .gitignore); skipped without it.
const have = existsSync(join(dir, "HIGHWAY_BOREHOLE_INPUT.csv"));

describe.skipIf(!have)("generated package", () => {
  it("every XML part is well-formed and the drawing element is in schema order", async () => {
    const parsed = parseBorehole({
      master: { name: "in.csv", sheets: [{ name: "csv", rows: parseCsv(readFileSync(join(dir, "HIGHWAY_BOREHOLE_INPUT.csv"), "utf8")) }] },
    });
    const wb = runBorehole(parsed, {}, () => {}).workbook!;
    const zip = await JSZip.loadAsync(await writeReport(wb));
    for (const name of Object.keys(zip.files)) {
      if (/\.(xml|rels)$/.test(name)) assertWellFormed(name, await zip.file(name)!.async("string"));
    }
    const sheet1 = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    // <drawing> must come after pageSetup/headerFooter and be the last child.
    expect(sheet1.indexOf("<pageSetup")).toBeGreaterThan(-1);
    expect(sheet1.indexOf("<drawing")).toBeGreaterThan(sheet1.indexOf("<pageSetup"));
    expect(sheet1.indexOf("<drawing")).toBeGreaterThan(sheet1.indexOf("<headerFooter"));
    expect(sheet1.trimEnd().endsWith('<drawing r:id="rIdDr1"/></worksheet>')).toBe(true);
    expect(sheet1).toContain("xmlns:r=");
  });
});

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "@civil/core";
import { drawingXml, writeReport } from "@civil/excel";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseBorehole, runBorehole } from "./index";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

// Project data is not committed (see .gitignore); these tests are skipped without it.
const have = existsSync(join(dir, "HIGHWAY_BOREHOLE_INPUT.csv")) && existsSync(join(dir, "Borehole_Sketches_Demo.xlsx"));

const parsed = parseBorehole({
  master: {
    name: "in.csv",
    sheets: [{ name: "csv", rows: parseCsv(have ? readFileSync(join(dir, "HIGHWAY_BOREHOLE_INPUT.csv"), "utf8") : "") }],
  },
});
const result = runBorehole(parsed, {}, () => {});

interface Shape {
  kind: "line" | "rect" | "ellipse" | "text";
  x: number;
  y: number;
  cx: number;
  cy: number;
  text?: string;
}

/** Flatten a drawing part into comparable shapes (EMU). Custom polylines become segments. */
function readShapes(xml: string): Shape[] {
  const out: Shape[] = [];
  for (const a of xml.split("</xdr:absoluteAnchor>")) {
    if (!a.includes("<xdr:pos")) continue;
    const off = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(a)!;
    const [x, y, cx, cy] = [off[1], off[2], off[3], off[4]].map(Number) as [number, number, number, number];
    if (a.includes("<xdr:cxnSp")) out.push({ kind: "line", x, y, cx, cy });
    else if (a.includes('txBox="1"')) {
      out.push({ kind: "text", x, y, cx, cy, text: /<a:t>([^<]*)<\/a:t>/.exec(a)?.[1] ?? "" });
    } else if (a.includes('prst="ellipse"')) out.push({ kind: "ellipse", x, y, cx, cy });
    else if (a.includes('prst="rect"')) out.push({ kind: "rect", x, y, cx, cy });
    else if (a.includes("<a:custGeom>")) {
      const pts = [...a.matchAll(/<a:pt x="(-?\d+)" y="(-?\d+)"\/>/g)].map((m) => [x + Number(m[1]), y + Number(m[2])] as const);
      for (let i = 1; i < pts.length; i++) {
        const [p, q] = [pts[i - 1]!, pts[i]!];
        out.push({ kind: "line", x: Math.min(p[0], q[0]), y: Math.min(p[1], q[1]), cx: Math.abs(q[0] - p[0]), cy: Math.abs(q[1] - p[1]) });
      }
    }
  }
  return out;
}

describe.skipIf(!have)("borehole report workbook", () => {
  it("has one sheet per structure plus COORDINATES", () => {
    const names = result.workbook!.map((s) => s.name);
    expect(names.slice(0, 10)).toEqual(Array.from({ length: 10 }, (_, i) => `STR-${String(i + 1).padStart(2, "0")}`));
    expect(names).toContain("COORDINATES");
    expect(result.sketches).toHaveLength(10);
  });

  it("builds a valid package with a drawing per structure", async () => {
    const buf = await writeReport(result.workbook!);
    const zip = await JSZip.loadAsync(buf);
    const drawings = Object.keys(zip.files).filter((n) => /xl\/drawings\/drawing\d+\.xml$/.test(n));
    expect(drawings).toHaveLength(10);
    const sheet1 = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet1).toContain("<drawing r:id=");
    expect(await zip.file("[Content_Types].xml")!.async("string")).toContain("drawing+xml");
    if (process.env.WRITE_REPORT) writeFileSync(process.env.WRITE_REPORT, new Uint8Array(buf));
  });

  it("sketch shapes match the reference workbook (STR-01 .. STR-08)", async () => {
    const ref = await JSZip.loadAsync(readFileSync(join(dir, "Borehole_Sketches_Demo.xlsx")));
    for (let i = 1; i <= 8; i++) {
      const refShapes = readShapes(await ref.file(`xl/drawings/drawing${i}.xml`)!.async("string"));
      const mine = readShapes(drawingXml(result.workbook![i - 1]!.drawing!));
      const label = `STR-0${i}`;

      for (const kind of ["rect", "ellipse", "line", "text"] as const) {
        const a = refShapes.filter((s) => s.kind === kind);
        const b = mine.filter((s) => s.kind === kind);
        expect(b.length, `${label} ${kind} count`).toBe(a.length);
      }
      // Non-text geometry must coincide (within ~0.2 pt rounding).
      const tol = 2600;
      for (const kind of ["rect", "ellipse", "line"] as const) {
        const a = refShapes.filter((s) => s.kind === kind);
        const b = mine.filter((s) => s.kind === kind);
        for (const s of a) {
          const hit = b.some(
            (t) => Math.abs(t.x - s.x) <= tol && Math.abs(t.y - s.y) <= tol && Math.abs(t.cx - s.cx) <= tol && Math.abs(t.cy - s.cy) <= tol,
          );
          expect(hit, `${label} ${kind} at ${s.x},${s.y} ${s.cx}x${s.cy}`).toBe(true);
        }
      }
      // Text content must match.
      const texts = (arr: Shape[]) => arr.filter((s) => s.kind === "text").map((s) => s.text).sort();
      expect(texts(mine), `${label} text`).toEqual(texts(refShapes));
    }
  });
});

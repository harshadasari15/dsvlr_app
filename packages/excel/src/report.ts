import type { CellStyle, RichSheet } from "@civil/tool-sdk";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { drawingXml } from "./drawingml";

const argb = (hex: string) => `FF${hex.toUpperCase()}`;

function styleCell(cell: ExcelJS.Cell, st: CellStyle | undefined, font: { name: string; size: number } | undefined) {
  const f: Partial<ExcelJS.Font> = {};
  if (font) {
    f.name = font.name;
    f.size = font.size;
  }
  if (st?.size) f.size = st.size;
  if (st?.bold) f.bold = true;
  if (st?.italic) f.italic = true;
  if (Object.keys(f).length) cell.font = f;
  if (st?.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(st.fill) } };
  if (st?.border) {
    const side = { style: "thin" as const };
    cell.border = { top: side, left: side, bottom: side, right: side };
  }
  if (st?.align || st?.wrap || st?.shrink) {
    cell.alignment = {
      horizontal: st.align,
      vertical: "middle",
      wrapText: st.wrap,
      shrinkToFit: st.shrink,
    };
  }
  if (st?.numFmt) cell.numFmt = st.numFmt;
}

function buildWorksheet(wb: ExcelJS.Workbook, sh: RichSheet) {
  const ws = wb.addWorksheet(sh.name.slice(0, 31), {
    views: [{ showGridLines: sh.showGrid ?? true, ...(sh.freezeRows ? { state: "frozen" as const, ySplit: sh.freezeRows } : {}) }],
  });
  for (const c of sh.cells) {
    const cell = ws.getCell(c.r, c.c);
    cell.value = c.v;
    styleCell(cell, c.s, sh.font);
  }
  for (const [r1, c1, r2, c2] of sh.merges ?? []) ws.mergeCells(r1, c1, r2, c2);
  for (const [col, w] of Object.entries(sh.colWidths ?? {})) ws.getColumn(Number(col)).width = w;
  for (const [row, h] of Object.entries(sh.rowHeights ?? {})) ws.getRow(Number(row)).height = h;
  if (sh.autoWidth) {
    const widths: number[] = [];
    for (const c of sh.cells) {
      const len = c.v === null ? 0 : String(c.v).length;
      widths[c.c] = Math.min(60, Math.max(widths[c.c] ?? 8, len + 2));
    }
    widths.forEach((w, i) => {
      if (w) ws.getColumn(i).width = w;
    });
  }
  if (sh.print) {
    const p = sh.print;
    ws.pageSetup = {
      orientation: p.landscape ? "landscape" : "portrait",
      paperSize: 9, // A4
      fitToPage: p.fitOnePage,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: p.centerH,
      ...(p.area ? { printArea: p.area } : {}),
    };
    ws.headerFooter = {
      oddFooter: `&L${p.footerLeft ?? ""}&C${p.footerCenter ?? ""}&R${p.footerRight ?? ""}`,
    };
  }
}

const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** Maps sheet names to their part paths inside the package. */
async function sheetPaths(zip: JSZip): Promise<Map<string, string>> {
  const wbXml = await zip.file("xl/workbook.xml")!.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const targets = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && target) targets.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }
  const out = new Map<string, string>();
  for (const m of wbXml.matchAll(/<sheet\b[^>]*>/g)) {
    const name = /\bname="([^"]+)"/.exec(m[0])?.[1];
    const rid = /\br:id="([^"]+)"/.exec(m[0])?.[1];
    const path = rid ? targets.get(rid) : undefined;
    if (name && path) out.set(name.replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"'), path);
  }
  return out;
}

/** Attach native shapes (a drawing part) to a worksheet part. */
async function attachDrawing(zip: JSZip, sheetPath: string, n: number, xml: string) {
  const drawingPath = `xl/drawings/drawing${n}.xml`;
  zip.file(drawingPath, xml);

  // Worksheet: reference the drawing just before </worksheet>.
  let sheetXml = await zip.file(sheetPath)!.async("string");
  const rid = `rIdDr${n}`;
  if (!sheetXml.includes(`xmlns:r=`)) {
    sheetXml = sheetXml.replace("<worksheet ", `<worksheet xmlns:r="${REL_NS}" `);
  }
  sheetXml = sheetXml.replace("</worksheet>", `<drawing r:id="${rid}"/></worksheet>`);
  zip.file(sheetPath, sheetXml);

  // Worksheet relationships.
  const dir = sheetPath.slice(0, sheetPath.lastIndexOf("/"));
  const file = sheetPath.slice(sheetPath.lastIndexOf("/") + 1);
  const relsPath = `${dir}/_rels/${file}.rels`;
  const rel = `<Relationship Id="${rid}" Type="${REL_NS}/drawing" Target="../drawings/drawing${n}.xml"/>`;
  const existing = zip.file(relsPath);
  if (existing) {
    const cur = await existing.async("string");
    zip.file(relsPath, cur.replace("</Relationships>", `${rel}</Relationships>`));
  } else {
    zip.file(
      relsPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`,
    );
  }

  // Content type.
  const ct = await zip.file("[Content_Types].xml")!.async("string");
  zip.file(
    "[Content_Types].xml",
    ct.replace(
      "</Types>",
      `<Override PartName="/${drawingPath}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`,
    ),
  );
}

/** Write rich sheets (styles, merges, print setup) plus native Excel shapes for sheets with a `drawing`. */
export async function writeReport(sheets: RichSheet[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  for (const sh of sheets) buildWorksheet(wb, sh);
  const base = await wb.xlsx.writeBuffer();

  const withDrawing = sheets.filter((s) => s.drawing && s.drawing.length > 0);
  if (withDrawing.length === 0) {
    const u8 = new Uint8Array(base as ArrayBuffer);
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
  }

  const zip = await JSZip.loadAsync(base as ArrayBuffer);
  const paths = await sheetPaths(zip);
  let n = 1;
  for (const sh of withDrawing) {
    const path = paths.get(sh.name.slice(0, 31));
    if (!path) throw new Error(`Could not locate worksheet "${sh.name}" to attach its drawing.`);
    await attachDrawing(zip, path, n++, drawingXml(sh.drawing!));
  }
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

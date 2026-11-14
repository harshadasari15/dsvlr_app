import { parseCsv } from "@civil/core";
import type { Cell, LoadedFile, OutputTable, SheetData } from "@civil/tool-sdk";
import ExcelJS from "exceljs";

export { writeReport } from "./report";
export { drawingXml } from "./drawingml";

/** Reduce any ExcelJS cell value (formula, rich text, date, ...) to a plain Cell. */
function plainValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return plainValue(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String((v as { text: unknown }).text);
    if ("error" in v) return null;
  }
  return null;
}

/** Decode an uploaded .xlsx / .csv into sheets. Throws on unsupported types. */
export async function readFile(name: string, data: ArrayBuffer): Promise<LoadedFile> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(data);
    return { name, sheets: [{ name: "csv", rows: parseCsv(text) }] };
  }
  if (lower.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(data);
    const sheets: SheetData[] = [];
    wb.eachSheet((ws) => {
      const rows: Cell[][] = [];
      ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        // ExcelJS cell arrays are 1-based (index 0 unused).
        const vals = (row.values as ExcelJS.CellValue[]).slice(1).map(plainValue);
        while (rows.length < rowNumber - 1) rows.push([]);
        rows.push(vals);
      });
      sheets.push({ name: ws.name, rows });
    });
    return { name, sheets };
  }
  throw new Error(`Unsupported file type: ${name}. Use .xlsx or .csv.`);
}

/** Tables -> sheet data (header row + rows). */
export function tablesToSheets(tables: OutputTable[]): SheetData[] {
  return tables.map((t) => ({ name: t.name, rows: [t.columns, ...t.rows] }));
}

/** Build an .xlsx with a bold, frozen header row and sensible column widths. */
export async function writeWorkbook(sheets: SheetData[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31));
    for (const row of sheet.rows) ws.addRow(row);
    const header = ws.getRow(1);
    header.font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const widths: number[] = [];
    for (const row of sheet.rows) {
      row.forEach((c, i) => {
        const len = c === null ? 0 : String(c).length;
        widths[i] = Math.min(60, Math.max(widths[i] ?? 8, len + 2));
      });
    }
    ws.columns.forEach((col, i) => {
      col.width = widths[i] ?? 10;
    });
  }
  const out = await wb.xlsx.writeBuffer();
  const u8 = new Uint8Array(out as ArrayBuffer);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

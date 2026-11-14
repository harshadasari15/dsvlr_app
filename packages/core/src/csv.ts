/**
 * Parse CSV text into rows of strings. Quote-aware ("" escapes a quote),
 * handles CRLF/LF, strips a UTF-8 BOM. Pure: no I/O.
 */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur !== "" || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

/** Trimmed text of a cell ("" for null/undefined). */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/**
 * Strict numeric parse of a cell. Returns null for blank, NaN for text that is
 * not a number (so callers can report it instead of silently using 0).
 */
export function cellNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  const s = cellText(v);
  if (s === "") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : Number.NaN;
}

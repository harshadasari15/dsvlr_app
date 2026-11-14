/**
 * Renderer-neutral drawing primitives. A tool describes a drawing once (in
 * points, origin top-left of the sheet) and it can be rendered as SVG in the
 * app preview or as native shapes inside an Excel worksheet.
 */

export type Dash = "solid" | "lgDashDot" | "dashDot";
export type HAlign = "L" | "C" | "R";
export type VAlign = "T" | "M" | "B";

export interface LinePrim {
  t: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string; // RRGGBB
  w: number; // pt
  dash?: Dash;
}
export interface PolyPrim {
  t: "poly";
  pts: [number, number][];
  color: string;
  w: number;
  dash?: Dash;
}
export interface RectPrim {
  t: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  lw: number;
}
export interface EllipsePrim {
  t: "ellipse";
  cx: number;
  cy: number;
  r: number;
  color: string;
  lw: number;
}
export interface TextPrim {
  t: "text";
  x: number;
  y: number;
  text: string;
  size: number; // pt
  h: HAlign;
  v: VAlign;
  rot: number; // degrees clockwise (0 or 270)
  color: string;
  bold: boolean;
}
export type Prim = LinePrim | PolyPrim | RectPrim | EllipsePrim | TextPrim;

/** Rough Arial Narrow advance width in points (good enough to size a text box). */
export function textWidth(text: string, size: number): number {
  let em = 0;
  for (const ch of text) {
    if (ch === " ") em += 0.28;
    else if (/[0-9]/.test(ch)) em += 0.556;
    else if (/[A-Z]/.test(ch)) em += 0.68;
    else if (/[a-z]/.test(ch)) em += 0.5;
    else em += 0.4;
  }
  return em * size * 0.82;
}

export interface TextBox {
  left: number;
  top: number;
  w: number;
  h: number;
  rot: number;
}

/** Text-box rectangle for a text primitive, positioned like the VBA `Txt` routine. */
export function textBox(p: TextPrim): TextBox {
  const w = textWidth(p.text, p.size);
  const h = p.size * 1.3;
  let left: number;
  let top: number;
  if (p.rot !== 0) {
    // Rotation is about the box centre; "B" puts the text just left of the point.
    left = p.x - w / 2 - (p.v === "B" ? h / 2 : 0);
    top = p.y - h / 2;
  } else {
    left = p.h === "L" ? p.x : p.h === "R" ? p.x - w : p.x - w / 2;
    top = p.v === "T" ? p.y : p.v === "B" ? p.y - h : p.y - h / 2;
  }
  return { left, top, w, h, rot: p.rot };
}

/** A drawing prepared for display next to its sheet. */
export interface SketchPreview {
  name: string;
  title: string;
  width: number; // pt
  height: number; // pt
  prims: Prim[];
}

// ---------------------------------------------------------------- rich sheets

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  size?: number;
  align?: "left" | "center" | "right";
  fill?: string; // RRGGBB
  border?: boolean;
  wrap?: boolean;
  shrink?: boolean;
  numFmt?: string;
}

export interface SheetCell {
  r: number; // 1-based
  c: number; // 1-based
  v: string | number | null;
  s?: CellStyle;
}

export interface RichSheet {
  name: string;
  cells: SheetCell[];
  /** [row1, col1, row2, col2], 1-based inclusive. */
  merges?: [number, number, number, number][];
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
  showGrid?: boolean;
  freezeRows?: number;
  autoWidth?: boolean;
  /** Font for all written cells. */
  font?: { name: string; size: number };
  print?: {
    landscape: boolean;
    fitOnePage: boolean;
    centerH: boolean;
    area?: string;
    footerLeft?: string;
    footerCenter?: string;
    footerRight?: string;
  };
  drawing?: Prim[];
}

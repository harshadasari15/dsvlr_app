import { textBox, type Prim, type TextPrim } from "@civil/tool-sdk";

const EMU = 12700; // per point
const e = (pt: number) => Math.round(pt * EMU);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const dashXml = (d?: string) => (d && d !== "solid" ? `<a:prstDash val="${d}"/>` : "");
const lnXml = (color: string, w: number, dash?: string) =>
  `<a:ln w="${e(w)}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${dashXml(dash)}</a:ln>`;

/** Wrap a shape in an absolute anchor at the given box (EMU). */
function anchor(x: number, y: number, cx: number, cy: number, shape: string): string {
  return (
    `<xdr:absoluteAnchor><xdr:pos x="${x}" y="${y}"/><xdr:ext cx="${Math.max(cx, 1)}" cy="${Math.max(cy, 1)}"/>` +
    `${shape}<xdr:clientData/></xdr:absoluteAnchor>`
  );
}

function spXml(id: number, name: string, xfrm: string, geom: string, ln: string, extra = "", txBox = false): string {
  return (
    `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id}" name="${name} ${id}"/>` +
    `<xdr:cNvSpPr${txBox ? ' txBox="1"' : ""}/></xdr:nvSpPr><xdr:spPr>${xfrm}${geom}${extra || "<a:noFill/>"}${ln}</xdr:spPr>`
  );
}

function textXml(id: number, p: TextPrim): string {
  const b = textBox(p);
  const x = e(b.left);
  const y = e(b.top);
  const cx = Math.max(e(b.w), 1);
  const cy = Math.max(e(b.h), 1);
  const rot = b.rot ? ` rot="${Math.round(b.rot * 60000)}"` : "";
  const algn = p.h === "L" ? "l" : p.h === "R" ? "r" : "ctr";
  const head =
    `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id}" name="Text ${id}"/><xdr:cNvSpPr txBox="1"/></xdr:nvSpPr>` +
    `<xdr:spPr><a:xfrm${rot}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></xdr:spPr>`;
  const body =
    `<xdr:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"/><a:lstStyle/>` +
    `<a:p><a:pPr algn="${algn}"/><a:r><a:rPr lang="en-US" sz="${Math.round(p.size * 100)}" b="${p.bold ? 1 : 0}">` +
    `<a:solidFill><a:srgbClr val="${p.color}"/></a:solidFill><a:latin typeface="Arial Narrow"/></a:rPr>` +
    `<a:t>${esc(p.text)}</a:t></a:r></a:p></xdr:txBody></xdr:sp>`;
  return anchor(x, y, cx, cy, head + body);
}

/** Build the xl/drawings/drawingN.xml document for a list of primitives. */
export function drawingXml(prims: Prim[]): string {
  let id = 2;
  const parts: string[] = [];
  for (const p of prims) {
    const sid = id++;
    switch (p.t) {
      case "line": {
        // Normalise so the box starts at the left; flip vertically for rising lines.
        const [xa, ya, xb, yb] = p.x1 <= p.x2 ? [p.x1, p.y1, p.x2, p.y2] : [p.x2, p.y2, p.x1, p.y1];
        const x = e(xa);
        const y = e(Math.min(ya, yb));
        const cx = e(xb - xa);
        const cy = e(Math.abs(yb - ya));
        const flip = yb < ya ? ' flipV="1"' : "";
        const shape =
          `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${sid}" name="Line ${sid}"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>` +
          `<xdr:spPr><a:xfrm${flip}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
          `<a:prstGeom prst="line"><a:avLst/></a:prstGeom>${lnXml(p.color, p.w, p.dash)}</xdr:spPr></xdr:cxnSp>`;
        parts.push(anchor(x, y, cx, cy, shape));
        break;
      }
      case "rect": {
        const x = e(p.x);
        const y = e(p.y);
        const cx = e(p.w);
        const cy = e(p.h);
        const xf = `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`;
        const shape =
          spXml(sid, "Shape", xf, '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>', lnXml(p.color, p.lw)) + "</xdr:sp>";
        parts.push(anchor(x, y, cx, cy, shape));
        break;
      }
      case "ellipse": {
        const x = e(p.cx - p.r);
        const y = e(p.cy - p.r);
        const d = e(2 * p.r);
        const xf = `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${d}" cy="${d}"/></a:xfrm>`;
        const shape =
          spXml(sid, "Shape", xf, '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>', lnXml(p.color, p.lw)) + "</xdr:sp>";
        parts.push(anchor(x, y, d, d, shape));
        break;
      }
      case "poly": {
        const xs = p.pts.map((q) => q[0]);
        const ys = p.pts.map((q) => q[1]);
        const x0 = Math.min(...xs);
        const y0 = Math.min(...ys);
        const x = e(x0);
        const y = e(y0);
        const cx = Math.max(e(Math.max(...xs) - x0), 1);
        const cy = Math.max(e(Math.max(...ys) - y0), 1);
        const path = p.pts
          .map(([px, py], i) => {
            const pt = `<a:pt x="${e(px - x0)}" y="${e(py - y0)}"/>`;
            return i === 0 ? `<a:moveTo>${pt}</a:moveTo>` : `<a:lnTo>${pt}</a:lnTo>`;
          })
          .join("");
        const geom =
          `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/>` +
          `<a:pathLst><a:path w="${cx}" h="${cy}" fill="none">${path}</a:path></a:pathLst></a:custGeom>`;
        const xf = `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`;
        parts.push(anchor(x, y, cx, cy, spXml(sid, "Polyline", xf, geom, lnXml(p.color, p.w, p.dash)) + "</xdr:sp>"));
        break;
      }
      case "text":
        parts.push(textXml(sid, p));
        break;
    }
  }
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${parts.join("")}</xdr:wsDr>`
  );
}

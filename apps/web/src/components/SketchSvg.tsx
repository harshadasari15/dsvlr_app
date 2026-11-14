import { textBox, type Prim, type SketchPreview } from "@civil/tool-sdk";

const dashArray = (d: string | undefined, w: number) =>
  d === "lgDashDot" ? `${w * 8} ${w * 3} ${w * 2} ${w * 3}` : d === "dashDot" ? `${w * 4} ${w * 3} ${w} ${w * 3}` : undefined;

function renderPrim(p: Prim, i: number) {
  switch (p.t) {
    case "line":
      return (
        <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={`#${p.color}`} strokeWidth={p.w} strokeDasharray={dashArray(p.dash, p.w)} />
      );
    case "poly":
      return (
        <polyline
          key={i}
          points={p.pts.map((q) => q.join(",")).join(" ")}
          fill="none"
          stroke={`#${p.color}`}
          strokeWidth={p.w}
          strokeDasharray={dashArray(p.dash, p.w)}
        />
      );
    case "rect":
      return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill="none" stroke={`#${p.color}`} strokeWidth={p.lw} />;
    case "ellipse":
      return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="none" stroke={`#${p.color}`} strokeWidth={p.lw} />;
    case "text": {
      const b = textBox(p);
      const cx = b.left + b.w / 2;
      const cy = b.top + b.h / 2;
      // Left/right alignment is anchored to the box edge; rotated text is centred in its box.
      const anchor = p.rot !== 0 ? "middle" : p.h === "L" ? "start" : p.h === "R" ? "end" : "middle";
      const x = p.rot !== 0 ? cx : p.h === "L" ? b.left : p.h === "R" ? b.left + b.w : cx;
      return (
        <text
          key={i}
          x={x}
          y={cy}
          fontSize={p.size}
          fontWeight={p.bold ? 700 : 400}
          fill={`#${p.color}`}
          textAnchor={anchor}
          dominantBaseline="central"
          fontFamily="Arial Narrow, Arial, sans-serif"
          transform={p.rot ? `rotate(${p.rot} ${cx} ${cy})` : undefined}
        >
          {p.text}
        </text>
      );
    }
  }
}

/** Light-background drawing: the sketch is a white sheet in both themes so its colours stay true. */
export default function SketchSvg({ sketch }: { sketch: SketchPreview }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-white">
      <figcaption className="border-b border-border bg-surface-2 px-3 py-2 text-xs font-medium">
        {sketch.name} <span className="font-normal text-muted">· {sketch.title}</span>
      </figcaption>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${sketch.width} ${sketch.height}`}
          className="block h-auto w-full min-w-[640px]"
          role="img"
          aria-label={`Sketch of ${sketch.title}`}
        >
          {sketch.prims.map(renderPrim)}
        </svg>
      </div>
    </figure>
  );
}

import type { PointMm } from "./model";
export function parseLength(text: string): number {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*$/i.exec(text);
  if (!match) throw new Error("Geçerli bir mm, cm veya m uzunluğu girin.");
  const value =
    Number(match[1]!.replace(",", ".")) *
    { mm: 1, cm: 10, m: 1000 }[match[2]?.toLowerCase() ?? "mm"]!;
  if (!Number.isFinite(value) || value <= 0 || value > 2e8)
    throw new Error("Uzunluk 0 ile 200000000 mm arasında olmalıdır.");
  return value;
}
export function segmentDistance(p: PointMm, a: PointMm, b: PointMm): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = dx * dx + dy * dy;
  const t = d
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / d))
    : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function snapPoint(
  raw: PointMm,
  options: {
    scale: number;
    gridMm: number;
    grid: boolean;
    axes: boolean;
    vertices: PointMm[];
    anchor?: PointMm;
    tolerancePx?: number;
  },
): {
  point: PointMm;
  kind: "vertex" | "grid" | "horizontal" | "vertical" | null;
} {
  const tol = (options.tolerancePx ?? 12) / options.scale;
  if (!Number.isFinite(tol) || tol < 0)
    return { point: { ...raw }, kind: null };
  let best: PointMm | undefined,
    bestD = Infinity;
  for (const v of options.vertices) {
    const d = Math.hypot(v.x - raw.x, v.y - raw.y);
    if (d <= tol && d < bestD) {
      best = v;
      bestD = d;
    }
  }
  if (best) return { point: { ...best }, kind: "vertex" };
  const candidates: {
    point: PointMm;
    kind: "grid" | "horizontal" | "vertical";
    distance: number;
  }[] = [];
  if (options.axes && options.anchor) {
    const a = options.anchor;
    candidates.push(
      {
        point: { x: raw.x, y: a.y },
        kind: "horizontal",
        distance: Math.abs(raw.y - a.y),
      },
      {
        point: { x: a.x, y: raw.y },
        kind: "vertical",
        distance: Math.abs(raw.x - a.x),
      },
    );
  }
  if (options.grid && Number.isFinite(options.gridMm) && options.gridMm > 0) {
    const g = options.gridMm,
      point = { x: Math.round(raw.x / g) * g, y: Math.round(raw.y / g) * g };
    candidates.push({
      point,
      kind: "grid",
      distance: Math.hypot(point.x - raw.x, point.y - raw.y),
    });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const c = candidates.find((c) => c.distance <= tol);
  return c
    ? { point: c.point, kind: c.kind }
    : { point: { ...raw }, kind: null };
}
export function fitViewport(
  points: PointMm[],
  width: number,
  height: number,
  padding = 40,
): { scale: number; x: number; y: number } {
  const usable = points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  if (!usable.length) return { scale: 0.08, x: 40, y: 40 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of usable) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const scale = Math.min(
    2,
    Math.max(1, width - 2 * padding) / (maxX - minX || 1),
    Math.max(1, height - 2 * padding) / (maxY - minY || 1),
  );
  return {
    scale,
    x: width / 2 - ((minX + maxX) / 2) * scale,
    y: height / 2 - ((minY + maxY) / 2) * scale,
  };
}

/** Find a point on an interior scanline, outside all completed holes. */
export function areaLabelPoint(
  outer: PointMm[],
  holes: PointMm[][],
): PointMm | null {
  if (outer.length < 3) return null;
  const rings = [outer, ...holes];
  const ys = rings.flatMap((r) => r.map((p) => p.y));
  const min = Math.min(...ys),
    max = Math.max(...ys);
  let best: PointMm | null = null,
    bestWidth = 0;
  function spans(r: PointMm[], y: number) {
    const hits: number[] = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i]!,
        b = r[(i + 1) % r.length]!;
      if (a.y > y !== b.y > y)
        hits.push(a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y));
    }
    hits.sort((a, b) => a - b);
    const intervals: [number, number][] = [];
    for (let i = 1; i < hits.length; i += 2)
      intervals.push([hits[i - 1]!, hits[i]!]);
    return intervals;
  }
  for (const fraction of [0.5, 0.25, 0.75, 0.125, 0.375, 0.625, 0.875]) {
    const y = min + (max - min) * fraction;
    let available = spans(outer, y);
    for (const hole of holes)
      for (const [l, r] of spans(hole, y))
        available = available.flatMap(([a, b]) =>
          r <= a || l >= b
            ? [[a, b]]
            : ([
                [a, Math.min(l, b)],
                [Math.max(r, a), b],
              ].filter(([x, z]) => z! > x!) as [number, number][]),
        );
    for (const [a, b] of available)
      if (b - a > bestWidth) {
        bestWidth = b - a;
        best = { x: (a + b) / 2, y };
      }
  }
  return best;
}

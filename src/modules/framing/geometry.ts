import type { DrawingDocument } from "../drawing/model";
import type { PointMm } from "../geometry/model";
import { FRAMING } from "./config";
export const EPS = FRAMING.epsilonMm;
export const distance = (a: PointMm, b: PointMm) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const uv = (p: PointMm, vertical: boolean): PointMm =>
  vertical ? { x: p.y, y: p.x } : { ...p };
export function pointInRing(p: PointMm, points: PointMm[]): number {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j]!,
      b = points[i]!;
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (
      Math.abs(cross) <= EPS * Math.max(1, distance(a, b)) &&
      p.x >= Math.min(a.x, b.x) - EPS &&
      p.x <= Math.max(a.x, b.x) + EPS &&
      p.y >= Math.min(a.y, b.y) - EPS &&
      p.y <= Math.max(a.y, b.y) + EPS
    )
      return 0;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside ? 1 : -1;
}
export function clipSegment(
  doc: DrawingDocument,
  start: PointMm,
  end: PointMm,
): { start: PointMm; end: PointMm }[] {
  const paths = doc.paths.filter(
      (p) => p.role === "outer" || p.role === "void",
    ),
    outer = paths.find((p) => p.role === "outer");
  if (!outer) return [];
  const dx = end.x - start.x,
    dy = end.y - start.y,
    l = distance(start, end);
  if (l < EPS) return [];
  const ts = [0, 1];
  for (const path of paths)
    for (let i = 0; i < path.points.length; i++) {
      const a = path.points[i]!,
        b = path.points[(i + 1) % path.points.length]!,
        ex = b.x - a.x,
        ey = b.y - a.y,
        den = dx * ey - dy * ex;
      if (Math.abs(den) > EPS) {
        const t = ((a.x - start.x) * ey - (a.y - start.y) * ex) / den,
          u = ((a.x - start.x) * dy - (a.y - start.y) * dx) / den;
        if (t > 0 && t < 1 && u >= -EPS && u <= 1 + EPS) ts.push(t);
      } else if (
        Math.abs((a.x - start.x) * dy - (a.y - start.y) * dx) <
        EPS * l
      ) {
        for (const p of [a, b]) {
          const t = ((p.x - start.x) * dx + (p.y - start.y) * dy) / (l * l);
          if (t > 0 && t < 1) ts.push(t);
        }
      }
    }
  ts.sort((a, b) => a - b);
  const at = (t: number) => ({ x: start.x + t * dx, y: start.y + t * dy });
  const out: { start: PointMm; end: PointMm }[] = [];
  for (let i = 1; i < ts.length; i++) {
    const a = ts[i - 1]!,
      b = ts[i]!;
    if ((b - a) * l < EPS) continue;
    const p = at((a + b) / 2);
    if (
      pointInRing(p, outer.points) >= 0 &&
      !paths.some((h) => h.role === "void" && pointInRing(p, h.points) > 0)
    ) {
      const prev = out.at(-1);
      if (prev && distance(prev.end, at(a)) < EPS) prev.end = at(b);
      else out.push({ start: at(a), end: at(b) });
    }
  }
  return out;
}
export function containsSegment(
  doc: DrawingDocument,
  a: PointMm,
  b: PointMm,
): boolean {
  return (
    clipSegment(doc, a, b).reduce((s, p) => s + distance(p.start, p.end), 0) >=
      distance(a, b) - EPS && distance(a, b) > EPS
  );
}
/** Unique point intersection; collinear overlap needs a connection design and has no unique contact. */
export function segmentIntersection(
  a: PointMm,
  b: PointMm,
  c: PointMm,
  d: PointMm,
): PointMm | null {
  const x = b.x - a.x,
    y = b.y - a.y,
    u = d.x - c.x,
    v = d.y - c.y,
    den = x * v - y * u;
  if (Math.abs(den) <= EPS) return null;
  const t = ((c.x - a.x) * v - (c.y - a.y) * u) / den,
    s = ((c.x - a.x) * y - (c.y - a.y) * x) / den;
  return t >= -EPS && t <= 1 + EPS && s >= -EPS && s <= 1 + EPS
    ? { x: a.x + t * x, y: a.y + t * y }
    : null;
}
export function pointOnSegment(p: PointMm, a: PointMm, b: PointMm): boolean {
  return Math.abs(distance(a, p) + distance(p, b) - distance(a, b)) <= EPS;
}

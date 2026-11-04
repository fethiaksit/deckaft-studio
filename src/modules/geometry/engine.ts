import * as clipping from "polygon-clipping";
import type { PointMm } from "./model";
export interface Ring {
  points: PointMm[];
  closed: boolean;
}
export const length = (a: PointMm, b: PointMm): number =>
  Math.hypot(b.x - a.x, b.y - a.y);
export function signedArea(points: PointMm[]): number {
  if (points.length < 3) return 0;
  const o = points[0]!;
  let sum = 0;
  for (let i = 1; i < points.length - 1; i++)
    sum +=
      (points[i]!.x - o.x) * (points[i + 1]!.y - o.y) -
      (points[i]!.y - o.y) * (points[i + 1]!.x - o.x);
  return sum / 2;
}
const cross = (a: PointMm, b: PointMm, c: PointMm) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const on = (a: PointMm, b: PointMm, p: PointMm) =>
  cross(a, b, p) === 0 &&
  p.x >= Math.min(a.x, b.x) &&
  p.x <= Math.max(a.x, b.x) &&
  p.y >= Math.min(a.y, b.y) &&
  p.y <= Math.max(a.y, b.y);
function intersects(a: PointMm, b: PointMm, c: PointMm, d: PointMm) {
  const ab1 = cross(a, b, c),
    ab2 = cross(a, b, d),
    cd1 = cross(c, d, a),
    cd2 = cross(c, d, b);
  return (
    (((ab1 > 0 && ab2 < 0) || (ab1 < 0 && ab2 > 0)) &&
      ((cd1 > 0 && cd2 < 0) || (cd1 < 0 && cd2 > 0))) ||
    on(a, b, c) ||
    on(a, b, d) ||
    on(c, d, a) ||
    on(c, d, b)
  );
}
export function validateRing(r: Ring): string[] {
  const errors: string[] = [];
  const p = r.points,
    n = p.length;
  if (!r.closed) errors.push("Sınır kapatılmalıdır.");
  if (n < 3) errors.push("En az üç köşe gereklidir.");
  if (
    p.some(
      (q) =>
        !Number.isFinite(q.x) ||
        !Number.isFinite(q.y) ||
        Math.abs(q.x) > 1e8 ||
        Math.abs(q.y) > 1e8,
    )
  )
    return [
      ...errors,
      "Koordinatlar sonlu ve ±100000000 mm sınırında olmalıdır.",
    ];
  for (let i = 0; i < n; i++) {
    const a = p[i]!,
      b = p[(i + 1) % n]!;
    if (length(a, b) === 0) errors.push("Sıfır uzunluklu kenar bulunamaz.");
    // Adjacent collinear edges must not double back and overlap.
    const c = p[(i + 2) % n]!;
    if (
      n >= 3 &&
      cross(a, b, c) === 0 &&
      (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y) > 0
    )
      errors.push("Komşu kenarlar üst üste gelemez.");
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (intersects(a, b, p[j]!, p[(j + 1) % n]!))
        errors.push("Sınır kendini kesemez veya kendine dokunamaz.");
    }
  }
  if (signedArea(p) === 0) errors.push("Alan sıfır olamaz.");
  return [...new Set(errors)];
}
const polygon = (r: Ring): clipping.Polygon => [
  r.points.map((p) => [p.x, p.y] as clipping.Pair),
];
function multiArea(polygons: clipping.MultiPolygon): number {
  return polygons.reduce(
    (sum, p) =>
      sum +
      p.reduce(
        (a, r, i) =>
          a +
          (i === 0 ? 1 : -1) *
            Math.abs(signedArea(r.map(([x, y]) => ({ x, y })))),
        0,
      ),
    0,
  );
}
export function areaReport(outer: Ring | null, voids: Ring[]) {
  const errors = outer
    ? validateRing(outer).map((e) => `Dış sınır: ${e}`)
    : ["Dış sınır gereklidir."];
  voids.forEach((r, i) =>
    errors.push(...validateRing(r).map((e) => `Boşluk ${i + 1}: ${e}`)),
  );
  const invalid = () => ({
    valid: false,
    errors,
    grossM2: null,
    excludedM2: null,
    netM2: null,
    perimeterM: null,
  });
  if (!outer || errors.length) return invalid();
  try {
    for (let i = 0; i < voids.length; i++)
      if (
        multiArea(clipping.difference(polygon(voids[i]!), polygon(outer))) > 0
      )
        errors.push(`Boşluk ${i + 1} dış sınırın içinde olmalıdır.`);
    if (errors.length) return invalid();
    const gross = Math.abs(signedArea(outer.points));
    const excluded = voids.length
      ? multiArea(
          clipping.union(polygon(voids[0]!), ...voids.slice(1).map(polygon)),
        )
      : 0;
    return {
      valid: true,
      errors,
      grossM2: gross / 1e6,
      excludedM2: excluded / 1e6,
      netM2: (gross - excluded) / 1e6,
      perimeterM:
        outer.points.reduce(
          (s, p, i) =>
            s + length(p, outer.points[(i + 1) % outer.points.length]!),
          0,
        ) / 1000,
    };
  } catch {
    errors.push("Geometri hesaplanamadı; sınırları kontrol edin.");
    return invalid();
  }
}
export function resizeEdge(
  points: PointMm[],
  closed: boolean,
  index: number,
  lengthMm: number,
  fixed: "start" | "end",
): PointMm[] {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= (closed ? points.length : points.length - 1) ||
    points.length < 2 ||
    !Number.isFinite(lengthMm) ||
    lengthMm <= 0 ||
    lengthMm > 2e8 ||
    (fixed !== "start" && fixed !== "end")
  )
    throw new Error("Geçerli kenar ve pozitif uzunluk gereklidir.");
  const end = (index + 1) % points.length,
    a = points[index]!,
    b = points[end]!,
    old = length(a, b);
  if (!old) throw new Error("Sıfır uzunluklu kenar düzenlenemez.");
  const dx = ((b.x - a.x) * lengthMm) / old,
    dy = ((b.y - a.y) * lengthMm) / old,
    result = points.map((p) => ({ ...p }));
  if (fixed === "start") result[end] = { x: a.x + dx, y: a.y + dy };
  else result[index] = { x: b.x - dx, y: b.y - dy };
  const errors = closed
    ? validateRing({ points: result, closed })
    : result.some(
          (p) =>
            !Number.isFinite(p.x) ||
            !Number.isFinite(p.y) ||
            Math.abs(p.x) > 1e8 ||
            Math.abs(p.y) > 1e8,
        )
      ? ["Koordinat sınırı aşıldı."]
      : [];
  if (errors.length) throw new Error(errors.join(" "));
  return result;
}

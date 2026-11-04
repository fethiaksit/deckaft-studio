import type { PointMm } from "../geometry/model";
export interface DrawingPath {
  id: string;
  points: PointMm[];
}
export interface Dimension {
  id: string;
  from: PointMm;
  to: PointMm;
  lengthMm: number;
}
export interface DrawingDocument {
  version: 1;
  unit: "mm";
  paths: DrawingPath[];
  dimensions: Dimension[];
}
export type DrawingTool = "draw" | "measure" | "select" | "pan";
export const emptyDrawing = (): DrawingDocument => ({
  version: 1,
  unit: "mm",
  paths: [],
  dimensions: [],
});
export function validPoint(p: PointMm): boolean {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Math.abs(p.x) <= 1e8 &&
    Math.abs(p.y) <= 1e8
  );
}
export function appendPoint(
  doc: DrawingDocument,
  pathId: string,
  point: PointMm,
): DrawingDocument {
  if (!validPoint(point))
    throw new Error("Koordinat geçersiz veya çalışma sınırının dışında.");
  const found = doc.paths.some((p) => p.id === pathId);
  return {
    ...doc,
    paths: found
      ? doc.paths.map((p) =>
          p.id === pathId ? { ...p, points: [...p.points, point] } : p,
        )
      : [...doc.paths, { id: pathId, points: [point] }],
  };
}
export function addDimension(
  doc: DrawingDocument,
  id: string,
  from: PointMm,
  to: PointMm,
): DrawingDocument {
  if (!validPoint(from) || !validPoint(to))
    throw new Error("Ölçü noktası geçersiz.");
  return {
    ...doc,
    dimensions: [
      ...doc.dimensions,
      { id, from, to, lengthMm: Math.hypot(to.x - from.x, to.y - from.y) },
    ],
  };
}
export function parseDrawing(json: string): DrawingDocument {
  const d = JSON.parse(json) as DrawingDocument;
  if (
    d?.version !== 1 ||
    d.unit !== "mm" ||
    !Array.isArray(d.paths) ||
    !Array.isArray(d.dimensions)
  )
    throw new Error("Çizim biçimi desteklenmiyor.");
  if (d.paths.length > 10000 || d.dimensions.length > 10000)
    throw new Error("Çizim çok büyük.");
  for (const p of d.paths)
    if (
      !p ||
      typeof p.id !== "string" ||
      !Array.isArray(p.points) ||
      p.points.some((v) => !v || !validPoint(v))
    )
      throw new Error("Çizim noktaları okunamadı.");
  for (const m of d.dimensions)
    if (
      !m ||
      typeof m.id !== "string" ||
      !m.from ||
      !m.to ||
      !validPoint(m.from) ||
      !validPoint(m.to) ||
      !Number.isFinite(m.lengthMm) ||
      m.lengthMm < 0 ||
      Math.abs(m.lengthMm - Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y)) >
        0.01
    )
      throw new Error("Ölçü verisi okunamadı.");
  return d;
}

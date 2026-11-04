import type { PointMm } from "../geometry/model";
import { areaReport, validateRing, resizeEdge } from "../geometry/engine";
import { segmentDistance } from "../geometry/interaction";
import {
  type DrawingDocument,
  type DrawingPath,
  type PathRole,
  type VoidKind,
  validPoint,
} from "./model";
import { DRAWING } from "./config";
export type Selection =
  | { kind: "edge" | "vertex"; pathId: string; index: number }
  | { kind: "dimension"; id: string };
export const pathVisible = (d: DrawingDocument, p: DrawingPath) =>
  p.role === "outer"
    ? d.layers.outer
    : p.role === "void"
      ? d.layers.voids
      : d.layers.outer;
export function drawingArea(d: DrawingDocument) {
  return areaReport(
    d.paths.find((p) => p.role === "outer") ?? null,
    d.paths.filter((p) => p.role === "void"),
  );
}
export function startRegion(
  d: DrawingDocument,
  id: string,
  role: PathRole,
  name: string,
  kind: VoidKind = "Özel boşluk",
): DrawingDocument {
  if (d.paths.length >= DRAWING.maxPaths)
    throw new Error("Alan sınırına ulaşıldı.");
  if (d.paths.some((p) => p.id === id) || d.dimensions.some((m) => m.id === id))
    throw new Error("Alan kimliği zaten var.");
  if (role === "outer" && d.paths.some((p) => p.role === "outer"))
    throw new Error(
      "Dış sınır zaten var. Önce mevcut dış sınırı düzenleyin veya silin.",
    );
  if (role === "void" && !d.paths.some((p) => p.role === "outer" && p.closed))
    throw new Error("Boşluk eklemeden önce dış alanı kapatın.");
  return {
    ...d,
    paths: [
      ...d.paths,
      {
        id,
        points: [],
        closed: false,
        role,
        name: name.trim().slice(0, 120) || "İsimsiz alan",
        ...(role === "void" ? { kind } : {}),
      },
    ],
  };
}
function replacePath(
  d: DrawingDocument,
  id: string,
  update: (p: DrawingPath) => DrawingPath,
): DrawingDocument {
  if (!d.paths.some((p) => p.id === id)) throw new Error("Alan bulunamadı.");
  return { ...d, paths: d.paths.map((p) => (p.id === id ? update(p) : p)) };
}
/** Closed edits must keep every completed region valid. Open drafts can still be saved. */
export function assertConsistency(d: DrawingDocument): void {
  for (const p of d.paths.filter((p) => p.closed)) {
    const errors = validateRing(p);
    if (errors.length) throw new Error(`${p.name}: ${errors[0]}`);
  }
  const outer = d.paths.find((p) => p.role === "outer");
  const holes = d.paths.filter((p) => p.role === "void" && p.closed);
  if (outer?.closed) {
    const result = areaReport(outer, holes);
    if (!result.valid)
      throw new Error(result.errors[0] ?? "Alan geometrisi geçersiz.");
  } else if (holes.length)
    throw new Error("Kapalı boşluklar için kapalı dış sınır gerekir.");
}
export function closeRegion(d: DrawingDocument, id: string): DrawingDocument {
  const next = replacePath(d, id, (p) => {
    let points = p.points;
    const first = points[0],
      last = points.at(-1);
    if (points.length > 1 && first?.x === last?.x && first?.y === last?.y)
      points = points.slice(0, -1);
    return { ...p, points, closed: true };
  });
  assertConsistency(next);
  return next;
}
export function movePoint(
  d: DrawingDocument,
  id: string,
  index: number,
  point: PointMm,
): DrawingDocument {
  if (!validPoint(point))
    throw new Error("Koordinat geçersiz veya sınırın dışında.");
  const next = replacePath(d, id, (p) => {
    if (!p.points[index]) throw new Error("Köşe bulunamadı.");
    return {
      ...p,
      points: p.points.map((v, i) => (i === index ? { ...point } : v)),
    };
  });
  assertConsistency(next);
  return next;
}
export function editEdge(
  d: DrawingDocument,
  id: string,
  index: number,
  lengthMm: number,
  fixed: "start" | "end",
): DrawingDocument {
  const next = replacePath(d, id, (p) => ({
    ...p,
    points: resizeEdge(p.points, p.closed, index, lengthMm, fixed),
  }));
  assertConsistency(next);
  return next;
}
export function updateRegion(
  d: DrawingDocument,
  id: string,
  values: { name?: string; role?: PathRole; kind?: VoidKind },
): DrawingDocument {
  if (
    values.role === "outer" &&
    d.paths.some((p) => p.id !== id && p.role === "outer")
  )
    throw new Error(
      "Yalnız bir dış sınır olabilir. Mevcut sınırın rolünü önce Çizgi olarak değiştirin.",
    );
  const next = replacePath(d, id, (p) => {
    const role = values.role ?? p.role;
    return {
      ...p,
      role,
      name: (values.name ?? p.name).trim().slice(0, 120) || "İsimsiz alan",
      kind:
        role === "void" ? (values.kind ?? p.kind ?? "Özel boşluk") : undefined,
    };
  });
  assertConsistency(next);
  return next;
}
export function deleteSelection(
  d: DrawingDocument,
  s: Selection,
): DrawingDocument {
  return s.kind === "dimension"
    ? { ...d, dimensions: d.dimensions.filter((m) => m.id !== s.id) }
    : { ...d, paths: d.paths.filter((p) => p.id !== s.pathId) };
}
export function selectAt(
  d: DrawingDocument,
  point: PointMm,
  scale: number,
  verticesOnly = false,
): Selection | null {
  let best = DRAWING.cornerTolerancePx / scale;
  let selected: Selection | null = null;
  const visible = d.paths.filter((p) => pathVisible(d, p));
  for (const p of visible)
    for (const [index, v] of p.points.entries()) {
      const distance = Math.hypot(v.x - point.x, v.y - point.y);
      if (distance <= best) {
        best = distance;
        selected = { kind: "vertex", pathId: p.id, index };
      }
    }
  if (selected || verticesOnly) return selected;
  best = DRAWING.hitTolerancePx / scale;
  for (const p of visible) {
    const count = p.closed ? p.points.length : p.points.length - 1;
    for (let i = 0; i < count; i++) {
      const a = p.points[i]!,
        b = p.points[(i + 1) % p.points.length]!;
      const distance = segmentDistance(point, a, b);
      if (distance < best) {
        best = distance;
        selected = { kind: "edge", pathId: p.id, index: i };
      }
    }
  }
  if (d.layers.dimensions)
    for (const m of d.dimensions) {
      const distance = segmentDistance(point, m.from, m.to);
      if (distance < best) {
        best = distance;
        selected = { kind: "dimension", id: m.id };
      }
    }
  return selected;
}
export function mergeVertex(
  d: DrawingDocument,
  id: string,
  index: number,
  toleranceMm: number,
): DrawingDocument {
  const p = d.paths.find((p) => p.id === id);
  const source = p?.points[index];
  if (!p || !source) throw new Error("Bir köşe seçin.");
  let target: { path: DrawingPath; index: number; point: PointMm } | null =
    null;
  let best = toleranceMm;
  for (const path of d.paths.filter((path) => pathVisible(d, path)))
    for (const [i, point] of path.points.entries()) {
      if (path.id === id && i === index) continue;
      const distance = Math.hypot(point.x - source.x, point.y - source.y);
      if (distance <= best) {
        best = distance;
        target = { path, index: i, point };
      }
    }
  if (!target) throw new Error("Yakalama toleransı içinde başka köşe yok.");
  if (target.path.id === id) {
    if (
      !p.closed &&
      ((index === 0 && target.index === p.points.length - 1) ||
        (target.index === 0 && index === p.points.length - 1))
    )
      return closeRegion(
        {
          ...d,
          paths: d.paths.map((path) =>
            path.id === id
              ? { ...path, points: path.points.filter((_, i) => i !== index) }
              : path,
          ),
        },
        id,
      );
    const adjacent =
      Math.abs(index - target.index) === 1 ||
      (p.closed && Math.abs(index - target.index) === p.points.length - 1);
    if (!adjacent)
      throw new Error("Aynı alanın komşu olmayan köşeleri birleştirilemez.");
    const next = replacePath(d, id, (path) => ({
      ...path,
      points: path.points.filter((_, i) => i !== index),
    }));
    assertConsistency(next);
    return next;
  }
  return movePoint(d, id, index, target.point);
}

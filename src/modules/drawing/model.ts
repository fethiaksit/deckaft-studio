import { validateRing } from "../geometry/engine";
import { checkConstraints, type EdgeConstraint } from "./constraints";
import type { PointMm } from "../geometry/model";
import { DRAWING } from "./config";
export const voidKinds = [
  "Ev",
  "Balkon",
  "Havuz",
  "Merdiven",
  "Kolon",
  "Kabin",
  "Özel boşluk",
] as const;
export type VoidKind = (typeof voidKinds)[number];
export type PathRole = "outer" | "void" | "draft";
export interface DrawingPath {
  id: string;
  points: PointMm[];
  closed: boolean;
  role: PathRole;
  name: string;
  kind?: VoidKind;
  constraints?: EdgeConstraint[];
}
export interface Dimension {
  id: string;
  from: PointMm;
  to: PointMm;
  lengthMm: number;
}
export interface LayerSettings {
  outer: boolean;
  voids: boolean;
  dimensions: boolean;
  grid: boolean;
}
export interface SnapSettings {
  grid: boolean;
  axes: boolean;
  vertices: boolean;
  gridMm: number;
}
export interface DrawingDocument {
  version: 2;
  unit: "mm";
  paths: DrawingPath[];
  dimensions: Dimension[];
  layers: LayerSettings;
  snap: SnapSettings;
}
export type DrawingTool = "draw" | "measure" | "select" | "move" | "pan";
export const emptyDrawing = (): DrawingDocument => ({
  version: 2,
  unit: "mm",
  paths: [],
  dimensions: [],
  layers: { outer: true, voids: true, dimensions: true, grid: true },
  snap: { grid: false, axes: true, vertices: true, gridMm: 100 },
});
export function validPoint(p: PointMm): boolean {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Math.abs(p.x) <= DRAWING.maxCoordinateMm &&
    Math.abs(p.y) <= DRAWING.maxCoordinateMm
  );
}
export function appendPoint(
  doc: DrawingDocument,
  pathId: string,
  point: PointMm,
): DrawingDocument {
  if (!validPoint(point))
    throw new Error("Koordinat geçersiz veya çalışma sınırının dışında.");
  const path = doc.paths.find((p) => p.id === pathId);
  if (path?.closed)
    throw new Error(
      "Alan kapalı. Yeni alan oluşturun veya bir köşeyi düzenleyin.",
    );
  if (path?.points.at(-1)?.x === point.x && path?.points.at(-1)?.y === point.y)
    throw new Error("Sıfır uzunluklu kenar eklenemez.");
  if (
    doc.paths.reduce((sum, p) => sum + p.points.length, 0) >= DRAWING.maxPoints
  )
    throw new Error("Çizimdeki nokta sınırına ulaşıldı.");
  return {
    ...doc,
    paths: path
      ? doc.paths.map((p) =>
          p.id === pathId ? { ...p, points: [...p.points, { ...point }] } : p,
        )
      : [
          ...doc.paths,
          {
            id: pathId,
            points: [{ ...point }],
            closed: false,
            role: doc.paths.some((p) => p.role === "outer") ? "draft" : "outer",
            name: doc.paths.some((p) => p.role === "outer")
              ? "Çizgi"
              : "Dış alan",
          },
        ],
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
  const lengthMm = Math.hypot(to.x - from.x, to.y - from.y);
  if (lengthMm <= DRAWING.epsilonMm)
    throw new Error("Ölçü uzunluğu sıfır olamaz.");
  return {
    ...doc,
    dimensions: [
      ...doc.dimensions,
      { id, from: { ...from }, to: { ...to }, lengthMm },
    ],
  };
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Çizim verisi okunamadı.");
  return value as Record<string, unknown>;
}
export const samePoint = (a: PointMm, b: PointMm, tol = 1e-5) =>
  Math.hypot(a.x - b.x, a.y - b.y) <= tol;
export function withoutClosingDuplicate(
  points: PointMm[],
  tol = 1e-4,
): PointMm[] {
  return points.length > 1 && samePoint(points[0]!, points.at(-1)!, tol)
    ? points.slice(0, -1)
    : points;
}
export function parseDrawing(json: string): DrawingDocument {
  const raw = record(JSON.parse(json));
  if (
    (raw.version !== 1 && raw.version !== 2) ||
    raw.unit !== "mm" ||
    !Array.isArray(raw.paths) ||
    !Array.isArray(raw.dimensions)
  )
    throw new Error("Çizim biçimi desteklenmiyor.");
  if (
    raw.paths.length > DRAWING.maxPaths ||
    raw.dimensions.length > DRAWING.maxPoints
  )
    throw new Error("Çizim çok büyük.");
  const ids = new Set<string>();
  let paths: DrawingPath[] = raw.paths.map((value, index) => {
    const p = record(value);
    if (
      typeof p.id !== "string" ||
      !p.id ||
      ids.has(p.id) ||
      !Array.isArray(p.points)
    )
      throw new Error("Çizgi kimliği veya noktaları okunamadı.");
    ids.add(p.id);
    const points = p.points.map((value) => {
      const point = record(value);
      if (!validPoint(point as unknown as PointMm))
        throw new Error("Çizim noktaları okunamadı.");
      return { x: point.x as number, y: point.y as number };
    });
    if (raw.version === 1) {
      const first = points[0],
        last = points.at(-1);
      const closed =
        points.length >= 4 &&
        first !== undefined &&
        last !== undefined &&
        samePoint(first, last);
      return {
        id: p.id,
        points: closed ? withoutClosingDuplicate(points) : points,
        closed,
        role: index === 0 ? "outer" : "draft",
        name: index === 0 ? "Dış alan" : `Çizgi ${index + 1}`,
      };
    }
    if (
      typeof p.closed !== "boolean" ||
      !["outer", "void", "draft"].includes(p.role as string) ||
      typeof p.name !== "string" ||
      p.name.length > 120 ||
      (p.role === "void" && !voidKinds.includes(p.kind as VoidKind))
    )
      throw new Error("Alan özellikleri okunamadı.");
    const unique = withoutClosingDuplicate(points);
    const recover =
      unique !== points &&
      unique.length >= 3 &&
      !validateRing({ points: unique, closed: true }).length;
    const path: DrawingPath = {
      id: p.id,
      points: recover ? unique : points,
      closed: p.closed || recover,
      role: p.role as PathRole,
      name: p.name,
      ...(p.role === "void" ? { kind: p.kind as VoidKind } : {}),
    };
    if (p.constraints !== undefined) {
      if (!Array.isArray(p.constraints) || p.constraints.length > points.length)
        throw Error("Kenar kısıtları okunamadı.");
      path.constraints = p.constraints.map((v) => {
        const c = record(v);
        return {
          index: c.index as number,
          ...(c.axis !== undefined
            ? { axis: c.axis as EdgeConstraint["axis"] }
            : {}),
          ...(c.lengthMm !== undefined
            ? { lengthMm: c.lengthMm as number }
            : {}),
        };
      });
      checkConstraints(path);
    }
    return path;
  });
  const dimensions: Dimension[] = raw.dimensions.map((value) => {
    const m = record(value);
    if (typeof m.id !== "string" || !m.id || ids.has(m.id))
      throw new Error("Ölçü kimliği okunamadı.");
    ids.add(m.id);
    const from = record(m.from),
      to = record(m.to);
    if (
      !validPoint(from as unknown as PointMm) ||
      !validPoint(to as unknown as PointMm) ||
      typeof m.lengthMm !== "number" ||
      !Number.isFinite(m.lengthMm) ||
      m.lengthMm < 0 ||
      Math.abs(
        m.lengthMm -
          Math.hypot(
            (to.x as number) - (from.x as number),
            (to.y as number) - (from.y as number),
          ),
      ) > 0.01
    )
      throw new Error("Ölçü verisi okunamadı.");
    return {
      id: m.id,
      from: { x: from.x as number, y: from.y as number },
      to: { x: to.x as number, y: to.y as number },
      lengthMm: m.lengthMm,
    };
  });
  const base = emptyDrawing();
  if (raw.version === 2) {
    const layers = record(raw.layers),
      snap = record(raw.snap);
    for (const key of ["outer", "voids", "dimensions", "grid"] as const)
      if (typeof layers[key] !== "boolean")
        throw new Error("Katman ayarları geçersiz.");
    for (const key of ["grid", "axes", "vertices"] as const)
      if (typeof snap[key] !== "boolean")
        throw new Error("Yakalama ayarları geçersiz.");
    if (
      typeof snap.gridMm !== "number" ||
      !Number.isFinite(snap.gridMm) ||
      snap.gridMm < DRAWING.minGridMm ||
      snap.gridMm > DRAWING.maxGridMm
    )
      throw new Error("Izgara aralığı geçersiz.");
    base.layers = layers as unknown as LayerSettings;
    base.snap = snap as unknown as SnapSettings;
  }
  if (paths.reduce((n, p) => n + p.points.length, 0) > DRAWING.maxPoints)
    throw Error("Çizim çok büyük.");
  const closedOuter = paths.find(
    (p) => p.role === "outer" && p.closed && p.points.length >= 3,
  );
  if (!closedOuter) {
    const closedDraftIndex = paths.findIndex(
      (p) =>
        p.role === "draft" &&
        p.closed &&
        p.points.length >= 3 &&
        !validateRing({ points: p.points, closed: true }).length,
    );
    if (closedDraftIndex >= 0) {
      paths = paths.map((p, idx) => {
        if (p.role === "outer" && !p.closed) {
          return { ...p, role: "draft" as PathRole, name: "Çizgi" };
        }
        if (idx === closedDraftIndex) {
          return { ...p, role: "outer" as PathRole, name: "Dış alan" };
        }
        return p;
      });
    }
  }
  if (paths.filter((p) => p.role === "outer").length > 1)
    throw new Error("Çizimde yalnız bir dış sınır olabilir.");
  return { ...base, paths, dimensions };
}

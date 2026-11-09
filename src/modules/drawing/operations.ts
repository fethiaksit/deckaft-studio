import type { PointMm } from "../geometry/model";
import { areaReport, validateRing, resizeEdge } from "../geometry/engine";
import { segmentDistance, snapPoint } from "../geometry/interaction";
import {
  type DrawingDocument,
  type DrawingPath,
  type PathRole,
  type VoidKind,
  validPoint,
  appendPoint,
  samePoint,
  withoutClosingDuplicate,
} from "./model";
import {
  alignEdge,
  checkConstraints,
  type EdgeConstraint,
} from "./constraints";
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
export interface GeometryResolution {
  valid: boolean;
  outer: DrawingPath | null;
  voids: DrawingPath[];
  drafts: DrawingPath[];
  grossM2: number | null;
  excludedM2: number | null;
  netM2: number | null;
  perimeterM: number | null;
  errors: string[];
  planState: "sketch" | "dimensioned" | "invalid";
  closedByCycle?: boolean;
}

export function resolveDrawingGeometry(d: DrawingDocument): GeometryResolution {
  let outer = d.paths.find((p) => p.role === "outer") ?? null;
  let closedByCycle = false;

  if (!outer || !outer.closed) {
    const closedDraft = d.paths.find(
      (p) => p.role === "draft" && p.closed && p.points.length >= 3,
    );
    if (closedDraft) {
      outer = closedDraft;
    } else {
      const cycle = findConnectedCycle(d.paths);
      if (cycle) {
        outer = {
          id: cycle.paths[0]!.id,
          points: cycle.points,
          closed: true,
          role: "outer",
          name: "Dış alan",
        };
        closedByCycle = true;
      }
    }
  }

  const voids = d.paths.filter(
    (p) => p.role === "void" && p.points.length >= 3,
  );
  const drafts = d.paths.filter((p) => p.role === "draft" && p !== outer);

  const report = areaReport(outer, voids);
  const gross = outer ? areaReport(outer, []) : null;

  const valid = report.valid;
  const grossM2 = valid ? report.grossM2 : (gross?.grossM2 ?? null);
  const netM2 = valid ? report.netM2 : null;
  const excludedM2 = valid ? report.excludedM2 : voids.length === 0 ? 0 : null;
  const perimeterM = valid ? report.perimeterM : (gross?.perimeterM ?? null);

  let planState: GeometryResolution["planState"] = "invalid";
  if (valid && outer) {
    const totalEdges = outer.points.length;
    const constrainedEdges = (outer.constraints ?? []).filter(
      (c) => c.lengthMm !== undefined,
    ).length;
    planState = constrainedEdges >= totalEdges ? "dimensioned" : "sketch";
  }

  return {
    valid,
    outer,
    voids,
    drafts,
    grossM2,
    excludedM2,
    netM2,
    perimeterM,
    errors: report.errors,
    planState,
    closedByCycle,
  };
}

export function drawingArea(d: DrawingDocument) {
  const res = resolveDrawingGeometry(d);
  return {
    valid: res.valid,
    errors: res.errors,
    grossM2: res.grossM2,
    excludedM2: res.excludedM2,
    netM2: res.netM2,
    perimeterM: res.perimeterM,
    planState: res.planState,
  };
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
  return {
    ...d,
    paths: d.paths.map((p) => {
      if (p.id !== id) return p;
      const next = update(p);
      if (
        !next.closed &&
        next.points.some((q, i) => i > 0 && samePoint(q, next.points[i - 1]!))
      )
        throw Error("Düzenleme sıfır uzunluklu bir kenar oluşturuyor.");
      return next;
    }),
  };
}
/** Closed edits must keep every completed region valid. Open drafts can still be saved. */
export function assertConsistency(d: DrawingDocument): void {
  for (const p of d.paths) checkConstraints(p);
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
  const p = d.paths.find((q) => q.id === id);
  if (!p) throw new Error("Alan bulunamadı.");

  if (p.points.length < 3) {
    const cycle = findConnectedCycle(d.paths, id);
    if (cycle) {
      return joinSketchLines(d, id);
    }
    throw new Error(
      "Alanı kapatmak için en az 3 köşe veya kapalı bir hat olmalıdır.",
    );
  }

  let next = replacePath(d, id, (path) => ({
    ...path,
    points: withoutClosingDuplicate(path.points),
    closed: true,
  }));

  const hasClosedOuter = next.paths.some(
    (q) =>
      q.role === "outer" && q.closed && q.points.length >= 3 && q.id !== id,
  );
  const thisPath = next.paths.find((q) => q.id === id)!;
  if (!hasClosedOuter && thisPath.role === "draft") {
    next = {
      ...next,
      paths: next.paths
        .map((q) =>
          q.role === "outer" && !q.closed
            ? { ...q, role: "draft" as PathRole, name: "Çizgi" }
            : q,
        )
        .map((q) =>
          q.id === id
            ? { ...q, role: "outer" as PathRole, name: "Dış alan" }
            : q,
        ),
    };
  }

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
  const moved = next.paths.find((p) => p.id === id)!;
  if (
    !moved.closed &&
    moved.points.length >= 4 &&
    samePoint(moved.points[0]!, moved.points.at(-1)!)
  )
    return closeRegion(next, id);
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
export function edgeEditChoices(
  d: DrawingDocument,
  id: string,
  index: number,
  lengthMm: number,
): ("start" | "end")[] {
  return (["start", "end"] as const).filter((fixed) => {
    try {
      editEdge(d, id, index, lengthMm, fixed);
      return true;
    } catch {
      return false;
    }
  });
}
export function setEdgeConstraint(
  d: DrawingDocument,
  id: string,
  index: number,
  lock: Omit<EdgeConstraint, "index">,
  fixed: "start" | "end" = "start",
): DrawingDocument {
  const next = replacePath(d, id, (p) => {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= p.points.length - (p.closed ? 0 : 1)
    )
      throw Error("Önce bir kenar seçin.");
    const end = (index + 1) % p.points.length;
    const a = p.points[index]!,
      b = p.points[end]!;
    const points = [...p.points];
    if (lock.axis && (lock.axis === "horizontal" ? a.y !== b.y : a.x !== b.x))
      points[fixed === "start" ? end : index] = alignEdge(
        a,
        b,
        lock.axis,
        fixed,
      );
    if (!points.every(validPoint)) throw Error("Koordinat sınırı aşıldı.");
    const constraints = (p.constraints ?? []).filter((c) => c.index !== index);
    if (lock.axis !== undefined || lock.lengthMm !== undefined)
      constraints.push({ ...lock, index });
    const { constraints: previous, ...rest } = p;
    return { ...rest, points, ...(constraints.length ? { constraints } : {}) };
  });
  assertConsistency(next);
  return next;
}

export function findConnectedCycle(
  paths: DrawingPath[],
  seedId?: string,
  tol = 1e-4,
): { paths: DrawingPath[]; points: PointMm[] } | null {
  const candidates = paths.filter(
    (p) => !p.closed && p.role !== "void" && p.points.length >= 2,
  );
  if (candidates.length < 2) return null;

  const seed = seedId ? candidates.find((p) => p.id === seedId) : candidates[0];
  if (!seed) return null;

  const match = (a: PointMm, b: PointMm) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= tol;

  const key = (p: PointMm) =>
    `${Math.round(p.x * 1000) / 1000},${Math.round(p.y * 1000) / 1000}`;
  const endpoints = new Map<
    string,
    { path: DrawingPath; end: "start" | "end" }[]
  >();

  for (const p of candidates) {
    for (const [end, pt] of [
      ["start", p.points[0]!],
      ["end", p.points.at(-1)!],
    ] as const) {
      let foundKey: string | null = null;
      for (const k of endpoints.keys()) {
        const [kx, ky] = k.split(",").map(Number);
        if (match({ x: kx!, y: ky! }, pt)) {
          foundKey = k;
          break;
        }
      }
      const k = foundKey ?? key(pt);
      const list = endpoints.get(k) ?? [];
      list.push({ path: p, end });
      endpoints.set(k, list);
    }
  }

  const component = new Set<DrawingPath>();
  const pending = [seed];
  while (pending.length) {
    const p = pending.pop()!;
    if (component.has(p)) continue;
    component.add(p);
    for (const pt of [p.points[0]!, p.points.at(-1)!]) {
      let list: { path: DrawingPath; end: "start" | "end" }[] = [];
      for (const [k, v] of endpoints.entries()) {
        const [kx, ky] = k.split(",").map(Number);
        if (match({ x: kx!, y: ky! }, pt)) {
          list = v;
          break;
        }
      }
      if (list.length !== 2) return null;
      for (const ep of list) {
        if (!component.has(ep.path)) pending.push(ep.path);
      }
    }
  }

  if (component.size < 2) return null;

  const compList = Array.from(component);
  const start = compList.find((p) => p.id === seed.id) ?? compList[0]!;
  const points = [...start.points];
  const used = new Set([start]);

  while (used.size < component.size) {
    const tail = points.at(-1)!;
    let next: DrawingPath | null = null;
    let reverse = false;

    for (const p of compList) {
      if (used.has(p)) continue;
      if (match(tail, p.points[0]!)) {
        next = p;
        reverse = false;
        break;
      }
      if (match(tail, p.points.at(-1)!)) {
        next = p;
        reverse = true;
        break;
      }
    }

    if (!next) return null;
    const ordered = reverse ? [...next.points].reverse() : next.points;
    for (let i = 1; i < ordered.length; i++) points.push(ordered[i]!);
    used.add(next);
  }

  if (!match(points[0]!, points.at(-1)!)) return null;

  const unique = withoutClosingDuplicate(points, tol);
  if (unique.length < 3) return null;

  const errors = validateRing({ points: unique, closed: true });
  if (errors.length) return null;

  return { paths: Array.from(component), points: unique };
}

export function findChainStart(
  paths: DrawingPath[],
  pathId: string,
  tol = 1e-4,
): PointMm | null {
  const p = paths.find((q) => q.id === pathId);
  if (!p || p.closed || p.points.length < 1) return null;

  const match = (a: PointMm, b: PointMm) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= tol;

  const candidates = paths.filter(
    (q) => !q.closed && q.role !== "void" && q.points.length >= 2,
  );
  if (candidates.length < 1) return null;

  let current = p.points[0]!;
  const visited = new Set<string>([pathId]);
  let steps = 0;

  while (steps < candidates.length) {
    const next = candidates.find(
      (q) =>
        !visited.has(q.id) &&
        (match(q.points.at(-1)!, current) || match(q.points[0]!, current)),
    );
    if (!next) break;

    visited.add(next.id);
    const reversed = match(next.points[0]!, current);
    current = reversed ? next.points.at(-1)! : next.points[0]!;
    steps++;
  }

  return steps > 0 ? current : null;
}

export function closureTarget(
  d: DrawingDocument,
  id: string,
  raw: PointMm,
  scale: number,
  withSnap = true,
): PointMm | null {
  const p = d.paths.find((q) => q.id === id);
  if (!p || p.closed || !pathVisible(d, p)) return null;

  const first = p.points[0];
  if (p.points.length >= 3 && first) {
    if (
      samePoint(first, raw) ||
      (withSnap &&
        scale > 0 &&
        Math.hypot(raw.x - first.x, raw.y - first.y) * scale <=
          DRAWING.snapTolerancePx)
    ) {
      return first;
    }
  }

  const chainStart = findChainStart(d.paths, id);
  if (chainStart) {
    if (
      samePoint(chainStart, raw) ||
      (withSnap &&
        scale > 0 &&
        Math.hypot(raw.x - chainStart.x, raw.y - chainStart.y) * scale <=
          DRAWING.snapTolerancePx)
    ) {
      return chainStart;
    }
  }

  return null;
}

export function addSketchPoint(
  d: DrawingDocument,
  id: string,
  raw: PointMm,
  scale: number,
  withSnap = true,
) {
  const active = d.paths.find((p) => p.id === id);
  if (active && !pathVisible(d, active))
    throw Error("Aktif alanın katmanını görünür yapın.");

  const target = closureTarget(d, id, raw, scale, withSnap);
  if (target) {
    if (
      active &&
      active.points.length >= 3 &&
      samePoint(active.points[0]!, target)
    ) {
      return {
        document: closeRegion(d, id),
        closed: true,
        hint: { point: target, kind: "vertex" as const },
      };
    }
    const chainStart = findChainStart(d.paths, id);
    if (chainStart && samePoint(chainStart, target)) {
      const docWithPoint = appendPoint(d, id, target);
      const joined = joinSketchLines(docWithPoint, id);
      return {
        document: joined,
        closed: true,
        hint: { point: target, kind: "vertex" as const },
      };
    }
  }

  const hint = withSnap
    ? snapPoint(raw, {
        scale,
        gridMm: d.snap.gridMm,
        grid: d.snap.grid,
        axes: d.snap.axes,
        vertices: d.snap.vertices
          ? d.paths
              .filter((p) => pathVisible(d, p))
              .flatMap((p) => (p.id === id ? p.points.slice(0, -1) : p.points))
          : [],
        anchor: active?.points.at(-1),
        tolerancePx: DRAWING.snapTolerancePx,
      })
    : { point: raw, kind: null };

  const snappedTarget = closureTarget(d, id, hint.point, scale, false);
  if (snappedTarget) {
    if (
      active &&
      active.points.length >= 3 &&
      samePoint(active.points[0]!, snappedTarget)
    ) {
      return { document: closeRegion(d, id), closed: true, hint };
    }
    const chainStart = findChainStart(d.paths, id);
    if (chainStart && samePoint(chainStart, snappedTarget)) {
      const docWithPoint = appendPoint(d, id, snappedTarget);
      const joined = joinSketchLines(docWithPoint, id);
      return { document: joined, closed: true, hint };
    }
  }

  return { document: appendPoint(d, id, hint.point), closed: false, hint };
}

/** Join only one exact, unbranched cycle rooted at the selected line. */
export function joinSketchLines(
  d: DrawingDocument,
  id: string,
): DrawingDocument {
  const cycle = findConnectedCycle(d.paths, id);
  if (!cycle) {
    const candidates = d.paths.filter(
      (p) =>
        !p.closed &&
        p.role !== "void" &&
        p.points.length >= 2 &&
        pathVisible(d, p),
    );
    const seed = candidates.find((p) => p.id === id);
    if (!seed) throw Error("Önce açık bir çizgi seçin.");
    if (candidates.length < 2)
      throw Error("Birleştirmek için en az iki çizgi gerekir.");
    throw Error("Uçlar aynı noktada birleşmeli; açık uç veya dal var.");
  }

  for (const p of cycle.paths) {
    if (p.constraints?.length)
      throw Error("Birleştirmeden önce ölçü kilitlerini kaldırın.");
  }

  const component = new Set(cycle.paths);
  const outer = d.paths.find((p) => p.role === "outer");
  const start = outer && component.has(outer) ? outer : cycle.paths[0]!;

  const hasOtherClosedOuter = d.paths.some(
    (p) => p.role === "outer" && p.closed && !component.has(p),
  );

  const merged = {
    ...start,
    points: cycle.points,
    closed: true,
    role: hasOtherClosedOuter ? ("draft" as const) : ("outer" as const),
    name: hasOtherClosedOuter ? start.name : "Dış alan",
  };

  const next = {
    ...d,
    paths: d.paths
      .map((p) =>
        p.role === "outer" && !p.closed && !component.has(p)
          ? { ...p, role: "draft" as PathRole, name: "Çizgi" }
          : p,
      )
      .flatMap((p) => (p === start ? [merged] : component.has(p) ? [] : [p])),
  };

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
    if (p.constraints?.length)
      throw Error("Birleştirmeden önce ölçü kilitlerini kaldırın.");
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

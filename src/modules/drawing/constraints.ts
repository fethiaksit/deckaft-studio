import type { PointMm } from "../geometry/model";
import type { DrawingPath } from "./model";

export interface EdgeConstraint {
  index: number;
  axis?: "horizontal" | "vertical";
  lengthMm?: number;
}

export function checkConstraints(path: DrawingPath): void {
  const seen = new Set<number>();
  for (const lock of path.constraints ?? []) {
    const { index, axis, lengthMm } = lock;
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= path.points.length - (path.closed ? 0 : 1) ||
      seen.has(index) ||
      (axis !== undefined && axis !== "horizontal" && axis !== "vertical") ||
      (lengthMm !== undefined &&
        (!Number.isFinite(lengthMm) || lengthMm <= 0)) ||
      (axis === undefined && lengthMm === undefined)
    )
      throw Error("Kenar kısıtı geçersiz.");
    seen.add(index);
    const a = path.points[index]!,
      b = path.points[(index + 1) % path.points.length]!;
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const tolerance = 1e-6;
    if (
      (axis === "horizontal" && Math.abs(dy) > tolerance) ||
      (axis === "vertical" && Math.abs(dx) > tolerance) ||
      (lengthMm !== undefined &&
        Math.abs(Math.hypot(dx, dy) - lengthMm) > tolerance)
    )
      throw Error(
        `Kenar ${index + 1}: ölçü kilidi veya yön kısıtı ile çelişiyor.`,
      );
  }
}

export function alignEdge(
  a: PointMm,
  b: PointMm,
  axis: NonNullable<EdgeConstraint["axis"]>,
  fixed: "start" | "end",
): PointMm {
  const span = Math.hypot(b.x - a.x, b.y - a.y);
  const direction = Math.sign(axis === "horizontal" ? b.x - a.x : b.y - a.y);
  if (!direction || !span)
    throw Error("Yön belirsiz. Önce köşenin koordinatını düzenleyin.");
  const anchor = fixed === "start" ? a : b;
  const offset = span * direction * (fixed === "start" ? 1 : -1);
  return axis === "horizontal"
    ? { x: anchor.x + offset, y: anchor.y }
    : { x: anchor.x, y: anchor.y + offset };
}

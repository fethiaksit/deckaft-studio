import type { PointMm } from "../geometry/model";
export interface Viewport {
  scale: number;
  x: number;
  y: number;
}
export const DEFAULT_VIEWPORT: Viewport = { scale: 0.08, x: 40, y: 40 };
export const worldToScreen = (p: PointMm, v: Viewport): PointMm => ({
  x: p.x * v.scale + v.x,
  y: p.y * v.scale + v.y,
});
export const screenToWorld = (p: PointMm, v: Viewport): PointMm => ({
  x: (p.x - v.x) / v.scale,
  y: (p.y - v.y) / v.scale,
});
export function zoomAt(v: Viewport, focal: PointMm, factor: number): Viewport {
  const point = screenToWorld(focal, v);
  const scale = Math.min(2, Math.max(0.005, v.scale * factor));
  return { scale, x: focal.x - point.x * scale, y: focal.y - point.y * scale };
}

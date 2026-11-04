/** All model coordinates are millimetres. Pixels belong only to the viewport. */
export interface PointMm {
  x: number;
  y: number;
}
export interface BoundsMm {
  min: PointMm;
  max: PointMm;
}
export interface PolygonMm {
  id: string;
  vertices: PointMm[];
  closed: boolean;
}
export type Millimetres = number;
export type SquareMetres = number;

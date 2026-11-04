import type { PointMm, Millimetres } from "../geometry/model";
export interface FramingSettings {
  joistSpacingMm: Millimetres;
  profileId: string;
  directionDegrees: number;
}
export interface FramingMember {
  id: string;
  start: PointMm;
  end: PointMm;
  profileId: string;
}
export interface FramingPlan {
  projectId: string;
  members: FramingMember[];
  settings: FramingSettings;
}

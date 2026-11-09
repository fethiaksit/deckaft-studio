import type {
  FramingLayer,
  FramingPlan,
  ProfileSection,
} from "../framing/model";
export type OptimizationStatus =
  "optimal" | "feasible" | "not-computed" | "invalid-input";
export interface CuttingOptions {
  stockLengthMm?: number;
  cutKerfMm?: number;
  startTrimMm?: number;
  endTrimMm?: number;
  minReusableMm?: number;
  maxSearchNodes?: number;
  maxSearchMs?: number;
}
export interface CuttingSettings {
  stockLengthMm: number;
  cutKerfMm: number;
  startTrimMm: number;
  endTrimMm: number;
  minReusableMm: number;
  cutRule: "per-piece-and-trim";
  resolutionMm: 0.001;
}
export interface CutPiece {
  memberId: string;
  code: string;
  layer: FramingLayer;
  actualLengthMm: number;
  lengthMm: number;
  sectionKey: string;
}
export interface CutStock {
  id: string;
  sectionKey: string;
  stockLengthMm: number;
  pieces: CutPiece[];
  usedMm: number;
  remainderMm: number;
  kerfMm: number;
  trimMm: number;
  reusableMm: number;
  wasteMm: number;
}
export interface CuttingExclusion {
  memberId: string;
  code: string;
  reason: string;
  kind: "invalid" | "splice" | "geometry";
}
export interface CuttingGroup {
  sectionKey: string;
  stockCount: number;
  stockLowerBound: number;
  optimizationStatus: "optimal" | "feasible";
  searchNodes: number;
  purchasedMm: number;
  pieceMm: number;
  kerfMm: number;
  remainderMm: number;
}
export interface RemnantInventoryItem {
  id: string;
  sourceCuttingPlanId: string;
  projectId: string;
  stockId: string;
  sectionKey: string;
  section: ProfileSection;
  lengthMm: number;
  createdAt: string;
  status: "available" | "stale";
}
export interface CuttingEstimate {
  status: "estimate-only";
  validForFabrication: false;
  optimizationStatus: OptimizationStatus;
  minimumStockCount: number | null;
  stockLowerBound: number;
  qualityRatio: number | null;
  sourcePlanId: string;
  sourcePlanUpdatedAt: string;
  settings: CuttingSettings;
  stockLengthMm: number;
  cutKerfMm: number;
  stocks: CutStock[];
  exclusions: CuttingExclusion[];
  groups: CuttingGroup[];
  remnants: { stockId: string; sectionKey: string; lengthMm: number }[];
  allMembersIncluded: boolean;
  totalPurchasedMm: number;
  totalPieceMm: number;
  totalKerfMm: number;
  totalTrimMm: number;
  totalRemainderMm: number;
  totalReusableMm: number;
  totalWasteMm: number;
  warnings: string[];
}
export interface CuttingPlan extends CuttingEstimate {
  version: 1;
  id: string;
  projectId: string;
  sourceRevision: string;
  createdAt: string;
  stale: boolean;
}
// The complete persisted framing document is the revision; timestamps alone are insufficient.
export const framingRevision = (plan: FramingPlan): string =>
  JSON.stringify(plan);

import type { PointMm } from "../geometry/model";
export type FramingLayer = "upper" | "lower" | "perimeter";
export type MemberRole = "regular" | "boundary" | "jointSupport" | "endSupport";
export interface ProfileSection {
  widthMm: number;
  heightMm: number;
  wallMm: number;
  material: "steel" | "aluminium";
}
export interface FramingSettings {
  unit: "mm";
  system: "two-layer";
  deckDirection: "horizontal" | "vertical";
  deckLengthMm: number;
  stockLengthMm: number;
  upperMaxSpacingMm: number;
  kerfMm: number;
  boardWidthMm: number | null;
  boardGapMm: number | null;
  edgeGapMm: number | null;
  jointGapMm: number | null;
  installationGapMm: number | null;
  lowerSpacingMm: number | null;
  supportSpacingMm: number | null;
  doubleJointSupport: boolean;
  upperSection: ProfileSection;
  lowerSection: ProfileSection;
  perimeterSection: ProfileSection;
  designLoadKnM2: number | null;
  allowableSpanMm: number | null;
}
export interface FramingMember {
  id: string;
  code: string;
  layer: FramingLayer;
  role: MemberRole;
  start: PointMm;
  end: PointMm;
  lengthMm: number;
  zBottomMm: number;
  section: ProfileSection;
  connectionIds: string[];
  method: "automatic" | "manual";
  requiresSplice: boolean;
  productionReady: false;
}
export interface DeckPiece {
  id: string;
  rowId: string;
  start: PointMm;
  end: PointMm;
  widthMm: number;
  lengthMm: number;
  startSupportId: string | null;
  endSupportId: string | null;
}
export interface DeckRow {
  id: string;
  start: PointMm;
  end: PointMm;
  widthMm: number;
  pieceIds: string[];
}
export interface DeckJoint {
  id: string;
  rowId: string;
  leftPieceId: string;
  rightPieceId: string;
  at: PointMm;
  supportIds: string[];
  verified: boolean;
}
export interface FramingConnection {
  id: string;
  memberIds: string[];
  at: PointMm;
  contactZMm: number;
  type: "crossing";
  designed: false;
}
export interface FramingSupport {
  id: string;
  at: PointMm;
  memberId: string | null;
  type: "foot" | "bearing";
  method: "automatic" | "manual";
  verified: false;
}
export interface SpliceRequirement {
  id: string;
  memberId: string;
  at: PointMm | null;
  designed: false;
}
export interface FramingWarning {
  code: string;
  message: string;
  memberId?: string;
  pieceId?: string;
}
export interface FramingPlan {
  version: 1;
  id: string;
  projectId: string;
  sourceGeometry: string;
  settings: FramingSettings;
  members: FramingMember[];
  rows: DeckRow[];
  pieces: DeckPiece[];
  joints: DeckJoint[];
  connections: FramingConnection[];
  supports: FramingSupport[];
  splices: SpliceRequirement[];
  manualChanges: { id: string; kind: string; memberId?: string; at: string }[];
  technicalStatus: "requires-approval";
  createdAt: string;
  updatedAt: string;
  warnings: FramingWarning[];
}
export interface FramingTotals {
  upperCount: number;
  upperLengthMm: number;
  lowerCount: number;
  lowerLengthMm: number;
  perimeterLengthMm: number;
  totalLengthMm: number;
  jointCount: number;
  supportCount: number;
  connectionCount: number;
}

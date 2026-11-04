export interface CutPiece {
  id: string;
  profileId: string;
  lengthMm: number;
  quantity: number;
}
export interface CuttingSettings {
  kerfMm: number;
  endTrimMm: number;
  stockLengthsMm: number[];
}
export interface CuttingPlan {
  projectId: string;
  settings: CuttingSettings;
  bars: { stockLengthMm: number; pieces: CutPiece[]; wasteMm: number }[];
}

import type { FramingSettings } from "./model";
export const FRAMING = {
  epsilonMm: 1e-5,
  maxMembers: 20000,
  maxRows: 5000,
  maxPieces: 50000,
  statusLabel: "Ön Yerleşim — Teknik Onay Gerekli",
  colors: {
    upper: "#F16B72",
    lower: "#539EFA",
    perimeter: "#E8B547",
    joint: "#F29645",
    void: "#68717D",
  },
} as const;
export function defaultFramingSettings(): FramingSettings {
  const section = {
    widthMm: 40,
    heightMm: 60,
    wallMm: 2,
    material: "steel" as const,
  };
  return {
    unit: "mm",
    system: "two-layer",
    deckDirection: "horizontal",
    deckLengthMm: 3000,
    stockLengthMm: 6000,
    upperMaxSpacingMm: 300,
    kerfMm: 3,
    boardWidthMm: null,
    boardGapMm: null,
    edgeGapMm: null,
    jointGapMm: null,
    installationGapMm: null,
    lowerSpacingMm: null,
    supportSpacingMm: null,
    doubleJointSupport: true,
    upperSection: { ...section },
    lowerSection: { ...section },
    perimeterSection: { ...section },
    designLoadKnM2: null,
    allowableSpanMm: null,
  };
}

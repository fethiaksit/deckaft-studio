import { defaultFramingSettings } from "../src/modules/framing/config";
import type { FramingMember, FramingPlan } from "../src/modules/framing/model";
export function member(
  id: string,
  lengthMm: number,
  opts: { wall?: number; splice?: boolean } = {},
): FramingMember {
  return {
    id,
    code: id,
    layer: "upper",
    role: "regular",
    start: { x: 0, y: 0 },
    end: { x: lengthMm, y: 0 },
    lengthMm,
    zBottomMm: 60,
    section: {
      widthMm: 40,
      heightMm: 60,
      wallMm: opts.wall ?? 2,
      material: "steel",
    },
    connectionIds: [],
    method: "automatic",
    requiresSplice: opts.splice ?? false,
    productionReady: false,
  };
}
export function plan(members: FramingMember[]): FramingPlan {
  return {
    version: 1,
    id: "plan-1",
    projectId: "p",
    sourceGeometry: "[]",
    settings: defaultFramingSettings(),
    members,
    rows: [],
    pieces: [],
    joints: [],
    connections: [],
    supports: [],
    splices: [],
    manualChanges: [],
    technicalStatus: "requires-approval",
    warnings: [],
    createdAt: "2026-11-05T00:00:00Z",
    updatedAt: "2026-11-05T00:00:00Z",
  };
}

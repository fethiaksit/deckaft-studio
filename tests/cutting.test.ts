import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCutting } from "../src/modules/cutting/engine";
import { defaultFramingSettings } from "../src/modules/framing/config";
import type { FramingMember, FramingPlan } from "../src/modules/framing/model";

function member(id: string, lengthMm: number, opts: { wall?: number; splice?: boolean } = {}): FramingMember {
  return {
    id, code: id, layer: "upper", role: "regular",
    start: { x: 0, y: 0 }, end: { x: lengthMm, y: 0 }, lengthMm,
    zBottomMm: 60,
    section: { widthMm: 40, heightMm: 60, wallMm: opts.wall ?? 2, material: "steel" },
    connectionIds: [], method: "automatic",
    requiresSplice: opts.splice ?? false, productionReady: false,
  };
}
function plan(members: FramingMember[]): FramingPlan {
  return {
    version: 1, id: "plan-1", projectId: "p", sourceGeometry: "[]",
    settings: defaultFramingSettings(), members, rows: [], pieces: [],
    joints: [], connections: [], supports: [], splices: [],
    manualChanges: [], technicalStatus: "requires-approval",
    warnings: [], createdAt: "2026-11-05T00:00:00Z", updatedAt: "2026-11-05T00:00:00Z",
  };
}
test("3000 + 3000 cannot share a 6000 stock with 3 mm kerf", () => {
  const result = estimateCutting(plan([member("A", 3000), member("B", 3000)]));
  assert.equal(result.stocks.length, 2);
  assert.equal(result.totalKerfMm, 6);
  assert.equal(result.totalRemainderMm, 5994);
  assert.equal(result.validForFabrication, false);
});
test("2450 + 1800 + 1700 fit with three kerfs", () => {
  const result = estimateCutting(plan([member("A", 2450), member("B", 1800), member("C", 1700)]));
  assert.equal(result.stocks.length, 1);
  assert.equal(result.totalRemainderMm, 41);
});
test("different profile sections never mix", () => {
  const result = estimateCutting(plan([member("A", 1500), member("B", 1500, { wall: 3 })]));
  assert.equal(result.stocks.length, 2);
  assert.equal(result.groups.length, 2);
});
test("unresolved long member is excluded, never automatically split", () => {
  const result = estimateCutting(plan([member("A", 7200), member("B", 1200)]));
  assert.equal(result.exclusions.length, 1);
  assert.equal(result.exclusions[0]?.memberId, "A");
  assert.equal(result.totalPieceMm, 1200);
  assert.equal(result.allMembersIncluded, false);
});
test("splice flagged even on short member is excluded", () => {
  const result = estimateCutting(plan([member("A", 2500, { splice: true })]));
  assert.equal(result.exclusions.length, 1);
});
test("invalid measured length is excluded", () => {
  const result = estimateCutting(plan([{ ...member("A", 2000), lengthMm: 1990 }]));
  assert.equal(result.exclusions.length, 1);
});
test("invalid kerf is rejected", () => {
  const p = plan([member("A", 1500)]);
  p.settings.kerfMm = -1;
  assert.throws(() => estimateCutting(p), /testere/i);
});
test("same input produces identical estimate", () => {
  const p = plan([member("A", 1200), member("B", 2200), member("C", 1400)]);
  assert.deepEqual(estimateCutting(p), estimateCutting(p));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDrawing,
  type DrawingDocument,
} from "../src/modules/drawing/model";
import { defaultFramingSettings } from "../src/modules/framing/config";
import { generateFraming, framingTotals } from "../src/modules/framing/engine";
import {
  addMember,
  translateMember,
  updateMember,
  removeMember,
  updateSupport,
} from "../src/modules/framing/operations";
import {
  createHistory,
  commit,
  undo,
  redo,
} from "../src/modules/drawing/history";
export const doc: DrawingDocument = {
  ...emptyDrawing(),
  paths: [
    {
      id: "outer",
      name: "Deck",
      role: "outer",
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: 4000 },
        { x: 0, y: 4000 },
      ],
    },
  ],
};
const now = "2026-11-05T00:00:00.000Z";
const plan = () =>
  generateFraming(
    doc,
    { ...defaultFramingSettings(), lowerSpacingMm: 1000 },
    { id: "plan", projectId: "p", now },
  );
test("manual add/move/resize/layer edits update exact geometry and totals without structural approval", () => {
  let p = plan();
  const original = framingTotals(p).totalLengthMm;
  p = addMember(
    p,
    doc,
    { start: { x: 100, y: 100 }, end: { x: 100, y: 1100 }, layer: "upper" },
    now,
  );
  const m = p.members.at(-1)!;
  assert.equal(m.method, "manual");
  assert.equal(framingTotals(p).totalLengthMm, original + 1000);
  p = translateMember(p, doc, m.id, 50, 0, now);
  assert.deepEqual(p.members.at(-1)?.start, { x: 150, y: 100 });
  p = updateMember(p, doc, m.id, { lengthMm: 1500, fixed: "start" }, now);
  assert.deepEqual(p.members.at(-1)?.end, { x: 150, y: 1600 });
  p = updateMember(p, doc, m.id, { layer: "lower" }, now);
  const edited = p.members.at(-1)!;
  assert.equal(edited.zBottomMm, 0);
  assert.equal(edited.productionReady, false);
  assert.equal(p.technicalStatus, "requires-approval");
  assert.equal(framingTotals(p).totalLengthMm, original + 1500);
  p = removeMember(p, doc, m.id, now);
  assert.equal(framingTotals(p).totalLengthMm, original);
  assert.ok(p.manualChanges.length >= 5);
});
test("invalid outside/zero-length manual edits are atomic; undo/redo restores full plan", () => {
  const p = plan();
  assert.throws(() =>
    addMember(
      p,
      doc,
      { start: { x: -100, y: 10 }, end: { x: 100, y: 10 }, layer: "upper" },
      now,
    ),
  );
  assert.throws(() =>
    addMember(
      p,
      doc,
      { start: { x: 100, y: 100 }, end: { x: 100, y: 100 }, layer: "upper" },
      now,
    ),
  );
  const next = addMember(
    p,
    doc,
    { start: { x: 100, y: 100 }, end: { x: 200, y: 200 }, layer: "upper" },
    now,
  );
  const h = commit(createHistory(p), next);
  assert.deepEqual(undo(h).present, p);
  assert.deepEqual(redo(undo(h)).present, next);
});
test("removing regular upper member diagnoses maximum spacing and supports can be edited explicitly", () => {
  let p = plan();
  const target = p.members.find(
    (m) =>
      m.layer === "upper" &&
      m.role === "regular" &&
      m.start.x > 1000 &&
      m.start.x < 4000,
  )!;
  assert.ok(target);
  p = removeMember(p, doc, target.id, now);
  assert.ok(p.warnings.some((w) => /aralık|aks/i.test(w.message)));
  p = updateSupport(
    p,
    doc,
    { at: { x: 100, y: 100 }, type: "bearing", memberId: null },
    now,
  );
  assert.equal(p.supports.at(-1)?.method, "manual");
  assert.equal(p.supports.at(-1)?.verified, false);
  assert.throws(() =>
    updateSupport(
      p,
      doc,
      { at: { x: -10, y: 0 }, type: "foot", memberId: null },
      now,
    ),
  );
});

test("automatic bearing point can be edited at boundary and removed without being silently regenerated", async () => {
  const { removeSupport } = await import("../src/modules/framing/operations");
  const { parseFraming } = await import("../src/modules/framing/persistence");
  let p = generateFraming(
    doc,
    {
      ...defaultFramingSettings(),
      lowerSpacingMm: 1000,
      supportSpacingMm: 1000,
    },
    { id: "with-feet", projectId: "p", now },
  );
  const foot = p.supports[0]!;
  const count = p.supports.length;
  p = updateSupport(
    p,
    doc,
    { id: foot.id, at: foot.at, type: "bearing", memberId: foot.memberId },
    now,
  );
  assert.equal(p.supports.length, count);
  assert.equal(p.supports.find((s) => s.id === foot.id)?.method, "manual");
  assert.deepEqual(parseFraming(JSON.stringify(p)), p);
  p = removeSupport(p, doc, foot.id, now);
  assert.equal(p.supports.length, count - 1);
  assert.ok(!p.supports.some((s) => s.id === foot.id));
});

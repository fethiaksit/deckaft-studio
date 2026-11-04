import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDrawing,
  parseDrawing,
  appendPoint,
} from "../src/modules/drawing/model";
import {
  startRegion,
  closeRegion,
  movePoint,
  editEdge,
  deleteSelection,
  drawingArea,
  selectAt,
} from "../src/modules/drawing/operations";
import { createEditor, editorReducer } from "../src/modules/drawing/editor";
const square = [
  { x: 0, y: 0 },
  { x: 10000, y: 0 },
  { x: 10000, y: 10000 },
  { x: 0, y: 10000 },
];
function deck() {
  let d = startRegion(emptyDrawing(), "outer", "outer", "Deck");
  for (const p of square) d = appendPoint(d, "outer", p);
  return closeRegion(d, "outer");
}
test("v1 drawings migrate without dropping free paths or dimensions and recognize explicit closure", () => {
  const legacy = {
    version: 1,
    unit: "mm",
    paths: [
      { id: "a", points: [...square, square[0]] },
      {
        id: "b",
        points: [
          { x: -20, y: 0 },
          { x: 20, y: 10 },
        ],
      },
    ],
    dimensions: [
      {
        id: "m",
        from: { x: 0, y: 0 },
        to: { x: 3000, y: 4000 },
        lengthMm: 5000,
      },
    ],
  };
  const d = parseDrawing(JSON.stringify(legacy));
  assert.equal(d.version, 2);
  assert.deepEqual(d.paths[0]?.points, square);
  assert.equal(d.paths[0]?.closed, true);
  assert.equal(d.paths[0]?.role, "outer");
  assert.deepEqual(d.paths[1]?.points, legacy.paths[1]?.points);
  assert.equal(d.paths[1]?.role, "draft");
  assert.deepEqual(d.dimensions, legacy.dimensions);
  assert.deepEqual(parseDrawing(JSON.stringify(d)), d);
});
test("outer closes and computes area; open void suppresses totals until closed", () => {
  let d = deck();
  assert.equal(drawingArea(d).netM2, 100);
  d = startRegion(d, "hole", "void", "Ev", "Ev");
  for (const p of [
    { x: 1000, y: 1000 },
    { x: 3000, y: 1000 },
    { x: 3000, y: 3000 },
    { x: 1000, y: 3000 },
  ])
    d = appendPoint(d, "hole", p);
  assert.equal(drawingArea(d).valid, false);
  assert.equal(drawingArea(d).netM2, null);
  d = closeRegion(d, "hole");
  assert.equal(drawingArea(d).netM2, 96);
});
test("edge resize and vertex move change real geometry atomically and invalid edits leave source intact", () => {
  const d = deck();
  const resized = editEdge(d, "outer", 0, 12000, "start");
  assert.deepEqual(resized.paths[0]?.points[1], { x: 12000, y: 0 });
  assert.equal(drawingArea(resized).grossM2, 110);
  assert.equal(drawingArea(d).grossM2, 100);
  const moved = movePoint(d, "outer", 2, { x: 8000, y: 8000 });
  assert.equal(drawingArea(moved).grossM2, 80);
  assert.throws(() => movePoint(d, "outer", 1, { x: 0, y: 0 }));
  assert.deepEqual(d.paths[0]?.points, square);
});
test("closed void outside deck is rejected and invalid vertex edit cannot strand an existing hole", () => {
  let d = deck();
  d = startRegion(d, "h", "void", "Havuz", "Havuz");
  for (const p of [
    { x: 8000, y: 1000 },
    { x: 9000, y: 1000 },
    { x: 9000, y: 2000 },
    { x: 8000, y: 2000 },
  ])
    d = appendPoint(d, "h", p);
  d = closeRegion(d, "h");
  assert.throws(() => movePoint(d, "h", 0, { x: 12000, y: 1000 }));
  assert.throws(() => editEdge(d, "outer", 0, 1000, "start"));
});
test("selection distinguishes edges and corners and respects hidden layers", () => {
  const d = deck();
  assert.deepEqual(selectAt(d, { x: 5000, y: 10 }, 0.1), {
    kind: "edge",
    pathId: "outer",
    index: 0,
  });
  assert.deepEqual(selectAt(d, { x: 0, y: 0 }, 0.1), {
    kind: "vertex",
    pathId: "outer",
    index: 0,
  });
  assert.equal(
    selectAt(
      { ...d, layers: { ...d.layers, outer: false } },
      { x: 5000, y: 0 },
      0.1,
    ),
    null,
  );
  assert.equal(
    drawingArea({ ...d, layers: { ...d.layers, outer: false } }).netM2,
    100,
  );
});
test("deletion and undo/redo restore all closed geometry and settings", () => {
  const d = deck();
  let e = createEditor(d, "outer");
  const changed = deleteSelection(d, {
    kind: "edge",
    pathId: "outer",
    index: 0,
  });
  assert.equal(changed.paths.length, 0);
  e = editorReducer(e, { type: "document", document: changed });
  assert.deepEqual(editorReducer(e, { type: "undo" }).history.present, d);
  assert.deepEqual(
    editorReducer(editorReducer(e, { type: "undo" }), { type: "redo" }).history
      .present,
    changed,
  );
});
test("v2 malformed settings, roles, and duplicate ids are rejected rather than silently repaired", () => {
  const d = deck();
  assert.throws(() =>
    parseDrawing(
      JSON.stringify({ ...d, layers: { ...d.layers, grid: "yes" } }),
    ),
  );
  assert.throws(() =>
    parseDrawing(JSON.stringify({ ...d, paths: [...d.paths, ...d.paths] })),
  );
  assert.throws(() =>
    parseDrawing(JSON.stringify({ ...d, snap: { ...d.snap, gridMm: 0 } })),
  );
});

test("corner merge excludes hidden layer candidates", async () => {
  const { mergeVertex } = await import("../src/modules/drawing/operations");
  let d = deck();
  d = startRegion(d, "hidden", "void", "Kolon", "Kolon");
  for (const p of [
    { x: 50, y: 50 },
    { x: 200, y: 50 },
    { x: 200, y: 200 },
    { x: 50, y: 200 },
  ])
    d = appendPoint(d, "hidden", p);
  d = closeRegion(d, "hidden");
  d = { ...d, layers: { ...d.layers, voids: false } };
  assert.throws(() => mergeVertex(d, "outer", 0, 100), /başka köşe/);
});

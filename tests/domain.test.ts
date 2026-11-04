import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProject } from "../src/modules/projects/model";
import {
  screenToWorld,
  worldToScreen,
  zoomAt,
} from "../src/modules/drawing/coordinates";
import {
  createHistory,
  commit,
  undo,
  redo,
} from "../src/modules/drawing/history";
import {
  emptyDrawing,
  appendPoint,
  addDimension,
  parseDrawing,
} from "../src/modules/drawing/model";

test("project validation rejects whitespace and oversized fields", () => {
  assert.throws(() =>
    validateProject({
      name: "  ",
      customer: "",
      city: "İzmir",
      district: "Urla",
      description: "",
      type: "Deck",
    }),
  );
  assert.throws(() =>
    validateProject({
      name: "a".repeat(121),
      customer: "",
      city: "İzmir",
      district: "Urla",
      description: "",
      type: "Deck",
    }),
  );
  assert.throws(() =>
    validateProject({
      name: "Teras",
      customer: "",
      city: "",
      district: "",
      description: "",
      type: "Deck",
    }),
  );
  assert.equal(
    validateProject({
      name: "  Teras  ",
      customer: "",
      city: "İzmir",
      district: "Urla",
      description: "",
      type: "Deck",
    }).name,
    "Teras",
  );
});
test("millimetres round trip independently of viewport scale and offset", () => {
  const v = { scale: 0.2, x: 40, y: -20 };
  assert.deepEqual(worldToScreen({ x: 1000, y: 500 }, v), { x: 240, y: 80 });
  assert.deepEqual(screenToWorld({ x: 240, y: 80 }, v), { x: 1000, y: 500 });
});
test("pinch keeps the world point beneath its focal pixel and clamps zoom", () => {
  const v = zoomAt({ scale: 0.1, x: 10, y: 20 }, { x: 110, y: 70 }, 2);
  assert.deepEqual(v, { scale: 0.2, x: -90, y: -30 });
  assert.deepEqual(screenToWorld({ x: 110, y: 70 }, v), { x: 1000, y: 500 });
  assert.equal(zoomAt(v, { x: 0, y: 0 }, 10000).scale, 2);
});
test("undo/redo restores documents and a new edit discards redo", () => {
  const initial = emptyDrawing();
  const first = appendPoint(initial, "p1", { x: 0, y: 0 });
  const second = appendPoint(first, "p1", { x: 1000, y: 0 });
  const h = commit(commit(createHistory(initial), first), second);
  assert.deepEqual(undo(h).present, first);
  assert.deepEqual(redo(undo(h)).present, second);
  assert.equal(
    commit(undo(h), appendPoint(first, "p1", { x: 0, y: 2000 })).future.length,
    0,
  );
  assert.equal(initial.paths.length, 0);
});
test("drawings validate persisted schema and keep explicit mm dimensions", () => {
  const d = addDimension(
    emptyDrawing(),
    "m1",
    { x: 0, y: 0 },
    { x: 3000, y: 4000 },
  );
  assert.equal(d.dimensions[0]?.lengthMm, 5000);
  assert.deepEqual(parseDrawing(JSON.stringify(d)), d);
  assert.throws(() => parseDrawing('{"version":2}'));
  assert.throws(() => appendPoint(d, "bad", { x: NaN, y: 0 }));
});

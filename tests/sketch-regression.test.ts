import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDrawing,
  parseDrawing,
  type DrawingPath,
} from "../src/modules/drawing/model";
import {
  drawingArea,
  addSketchPoint,
  joinSketchLines,
  closeRegion,
  edgeEditChoices,
  editEdge,
  movePoint,
  setEdgeConstraint,
} from "../src/modules/drawing/operations";
import {
  areaLabelPoint,
  fitViewport,
} from "../src/modules/geometry/interaction";
import { worldToScreen } from "../src/modules/drawing/coordinates";
const point = (x: number, y: number) => ({ x, y });
const square = [point(0, 0), point(4000, 0), point(4000, 5000), point(0, 5000)];
const path = (
  points = square,
  role: DrawingPath["role"] = "outer",
  closed = true,
  id = "a",
): DrawingPath => ({
  id,
  points,
  role,
  closed,
  name: id,
  ...(role === "void" ? { kind: "Havuz" as const } : {}),
});
const doc = (...paths: DrawingPath[]) => ({ ...emptyDrawing(), paths });
test("screen tolerance closes at any zoom with generic vertex snap disabled", () => {
  for (const scale of [0.08, 0.8, 0.008]) {
    const d = doc(path(square, "outer", false));
    d.snap.vertices = false;
    const r = addSketchPoint(d, "a", point(10 / scale, 0), scale);
    assert.equal(r.closed, true);
    assert.deepEqual(r.document.paths[0]?.points, square);
    assert.equal(drawingArea(r.document).netM2, 20);
    assert.equal(
      addSketchPoint(d, "a", point(-13 / scale, 0), scale).closed,
      false,
    );
  }
});
test("stored exact duplicate closing coordinate is recovered, never inferred from a gap", () => {
  const r = parseDrawing(
    JSON.stringify(doc(path([...square, square[0]!], "outer", false))),
  );
  assert.equal(drawingArea(r).netM2, 20);
  assert.equal(r.paths[0]?.points.length, 4);
  assert.equal(
    drawingArea(
      parseDrawing(
        JSON.stringify(doc(path([...square, point(1, 0)], "outer", false))),
      ),
    ).netM2,
    null,
  );
});
test("independent draft leaves net available; unfinished hole leaves gross only", () => {
  const outer = path([
    point(0, 0),
    point(10000, 0),
    point(10000, 10000),
    point(0, 10000),
  ]);
  const hole = path(
    [
      point(1000, 1000),
      point(3000, 1000),
      point(3000, 3000),
      point(1000, 3000),
    ],
    "void",
    true,
    "hole",
  );
  assert.equal(
    drawingArea(
      doc(outer, path([point(0, 0), point(1, 2)], "draft", false, "draft")),
    ).netM2,
    100,
  );
  assert.equal(drawingArea(doc(outer, hole)).netM2, 96);
  const report = drawingArea(doc(outer, { ...hole, closed: false }));
  assert.equal(report.grossM2, 100);
  assert.equal(report.netM2, null);
});
test("joining coincident endpoints is atomic, supports reverse segments and rejects gaps and branches", () => {
  const [a, b, c, d] = square as [
    (typeof square)[number],
    (typeof square)[number],
    (typeof square)[number],
    (typeof square)[number],
  ];
  const lines = [
    path([a, b], "draft", false, "1"),
    path([c, b], "draft", false, "2"),
    path([c, d], "draft", false, "3"),
    path([d, a], "draft", false, "4"),
  ];
  const merged = joinSketchLines(doc(...lines), "2");
  assert.equal(merged.paths.length, 1);
  assert.equal(drawingArea(merged).netM2, 20);
  assert.throws(() =>
    joinSketchLines(
      doc(...lines.slice(0, 3), path([d, point(1, 0)], "draft", false, "4")),
      "1",
    ),
  );
  assert.throws(() =>
    joinSketchLines(
      doc(...lines, path([a, point(-5, 0)], "draft", false, "5")),
      "1",
    ),
  );
});
test("local edge choices preserve topology, locked adjacent edges reject contradictory edits", () => {
  const d = doc(
    path([point(0, 0), point(2500, 0), point(2500, 4000), point(0, 4000)]),
  );
  assert.deepEqual(edgeEditChoices(d, "a", 0, 3000), ["start", "end"]);
  const next = editEdge(d, "a", 0, 3000, "start");
  assert.deepEqual(next.paths[0]?.points, [
    point(0, 0),
    point(3000, 0),
    point(2500, 4000),
    point(0, 4000),
  ]);
  const locked = setEdgeConstraint(d, "a", 1, {
    lengthMm: 4000,
    axis: "vertical",
  });
  assert.deepEqual(edgeEditChoices(locked, "a", 0, 3000), ["end"]);
  assert.throws(() => editEdge(locked, "a", 0, 3000, "start"));
  assert.throws(() => movePoint(locked, "a", 1, point(3000, 0)));
  assert.deepEqual(parseDrawing(JSON.stringify(locked)), locked);
});
test("fit includes a large drawing without changing mm geometry", () => {
  const points = [point(-1e8, -1e8), point(1e8, 1e8)];
  const v = fitViewport(points, 400, 500);
  for (const p of points) {
    const s = worldToScreen(p, v);
    assert.ok(s.x >= 0 && s.x <= 400 && s.y >= 0 && s.y <= 500);
  }
});

test("U-shaped area and in-area label avoid the central gap", () => {
  const u = [
    point(0, 0),
    point(6000, 0),
    point(6000, 6000),
    point(4000, 6000),
    point(4000, 2000),
    point(2000, 2000),
    point(2000, 6000),
    point(0, 6000),
  ];
  assert.equal(drawingArea(doc(path(u))).netM2, 28);
  const pos = areaLabelPoint(u, []);
  assert.ok(pos && (pos.y < 2000 || pos.x < 2000 || pos.x > 4000));
});

test("an open sketch cannot collapse an adjacent edge while resizing", () => {
  const d = doc(
    path([point(0, 0), point(2500, 0), point(3000, 0)], "outer", false),
  );
  assert.deepEqual(edgeEditChoices(d, "a", 0, 3000), ["end"]);
  assert.throws(() => editEdge(d, "a", 0, 3000, "start"), /sıfır/i);
});

test("4x5m closed area = 20 m2, 10x10m = 100 m2, 10x10m - 2x2m hole = 96 m2, L-shape = 64 m2", () => {
  // 4x5m = 20 m2
  const rect4x5 = doc(
    path([point(0, 0), point(4000, 0), point(4000, 5000), point(0, 5000)]),
  );
  assert.equal(drawingArea(rect4x5).netM2, 20);

  // 10x10m = 100 m2
  const square10x10 = doc(
    path([point(0, 0), point(10000, 0), point(10000, 10000), point(0, 10000)]),
  );
  assert.equal(drawingArea(square10x10).netM2, 100);

  // 10x10m - 2x2m hole = 96 m2
  const withHole = doc(
    path([point(0, 0), point(10000, 0), point(10000, 10000), point(0, 10000)]),
    path(
      [
        point(2000, 2000),
        point(4000, 2000),
        point(4000, 4000),
        point(2000, 4000),
      ],
      "void",
      true,
      "void-1",
    ),
  );
  assert.equal(drawingArea(withHole).netM2, 96);

  // L-shape = 64 m2
  const lShape = doc(
    path([
      point(0, 0),
      point(10000, 0),
      point(10000, 4000),
      point(4000, 4000),
      point(4000, 10000),
      point(0, 10000),
    ]),
  );
  assert.equal(drawingArea(lShape).netM2, 64);
});

test("consecutive line segments forming a closed loop are recognized, compute 20 m2, and closeRegion joins them", () => {
  const lines = [
    path([point(0, 0), point(4000, 0)], "outer", false, "1"),
    path([point(4000, 0), point(4000, 5000)], "draft", false, "2"),
    path([point(4000, 5000), point(0, 5000)], "draft", false, "3"),
    path([point(0, 5000), point(0, 0)], "draft", false, "4"),
  ];
  const d = doc(...lines);
  const report = drawingArea(d);
  assert.equal(report.valid, true);
  assert.equal(report.netM2, 20);

  // Calling closeRegion on line "4" joins all 4 lines and marks closed: true with role: outer
  const closed = closeRegion(d, "4");
  assert.equal(closed.paths.length, 1);
  assert.equal(closed.paths[0]?.closed, true);
  assert.equal(closed.paths[0]?.role, "outer");
  assert.equal(drawingArea(closed).netM2, 20);
});

test("closed polygon mistakenly saved as draft is healed to outer and computes area", () => {
  const d = doc(
    path([point(0, 0), point(100, 0)], "outer", false, "orphaned-segment"),
    path(square, "draft", true, "closed-draft-polygon"),
  );
  const report = drawingArea(d);
  assert.equal(report.valid, true);
  assert.equal(report.netM2, 20);

  // parseDrawing heals it on read
  const parsed = parseDrawing(JSON.stringify(d));
  const outer = parsed.paths.find((p) => p.role === "outer");
  assert.equal(outer?.closed, true);
  assert.equal(drawingArea(parsed).netM2, 20);
});

test("parseLength strictly parses 250 cm -> 2500 mm and 6 m -> 6000 mm", async () => {
  const { parseLength } = await import("../src/modules/geometry/interaction");
  assert.equal(parseLength("250 cm"), 2500);
  assert.equal(parseLength("2500 mm"), 2500);
  assert.equal(parseLength("6 m"), 6000);
  assert.equal(parseLength("6000 mm"), 6000);
  assert.equal(parseLength("600 cm"), 6000);
  assert.throws(() => parseLength("invalid"), /geçerli/i);
  assert.throws(() => parseLength("-5 m"), /geçerli/i);
  assert.throws(() => parseLength("0 mm"), /arasında/i);
});

test("zoom and pan operations do not mutate mm geometry coordinates", async () => {
  const { zoomAt, screenToWorld, worldToScreen } =
    await import("../src/modules/drawing/coordinates");
  let v = { scale: 0.1, x: 50, y: 50 };
  const original = point(4000, 5000);

  // Zoom in
  v = zoomAt(v, { x: 200, y: 200 }, 1.5);
  // Pan
  v = { ...v, x: v.x + 100, y: v.y - 80 };
  // Zoom out
  v = zoomAt(v, { x: 200, y: 200 }, 0.5);

  const screen = worldToScreen(original, v);
  const backToWorld = screenToWorld(screen, v);
  assert.ok(Math.abs(backToWorld.x - original.x) < 1e-4);
  assert.ok(Math.abs(backToWorld.y - original.y) < 1e-4);
});

test("edge resizing preserves closed status and invalid edit leaves geometry intact", () => {
  const d = doc(
    path([point(0, 0), point(4000, 0), point(4000, 5000), point(0, 5000)]),
  );
  assert.equal(drawingArea(d).netM2, 20);

  // Valid resize: bottom edge 4000 -> 6000 mm creates trapezoid with bases 6m and 4m, height 5m = 25 m2
  const resized = editEdge(d, "a", 0, 6000, "start");
  assert.equal(resized.paths[0]?.closed, true);
  assert.equal(drawingArea(resized).grossM2, 25);

  // Invalid edit (negative length or zero) throws and does not corrupt source
  assert.throws(() => editEdge(d, "a", 0, -100, "start"));
  assert.throws(() => editEdge(d, "a", 0, 0, "start"));
  assert.equal(drawingArea(d).netM2, 20);
});

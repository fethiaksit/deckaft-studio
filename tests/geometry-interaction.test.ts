import test from "node:test";
import assert from "node:assert/strict";
import {
  parseLength,
  snapPoint,
  fitViewport,
  segmentDistance,
} from "../src/modules/geometry/interaction";
test("parses explicit metric lengths strictly", () => {
  for (const [s, n] of [
    ["250 cm", 2500],
    ["3,75 m", 3750],
    ["1250 mm", 1250],
    ["12.5", 12.5],
  ] as const)
    assert.equal(parseLength(s), n);
  for (const s of [
    "",
    "0",
    "-1",
    "1e3",
    "2m junk",
    "Infinity",
    "200000001 mm",
    "1,2.3",
    "+3",
  ])
    assert.throws(() => parseLength(s));
});
test("snapping uses pixel tolerance and nearest vertex priority", () => {
  for (const scale of [0.01, 1, 2]) {
    const opts = {
      scale,
      gridMm: 100,
      grid: false,
      axes: false,
      vertices: [
        { x: 10 / scale, y: 0 },
        { x: 5 / scale, y: 0 },
      ],
    };
    assert.equal(snapPoint({ x: 0, y: 0 }, opts).point.x, 5 / scale);
    assert.equal(snapPoint({ x: 30 / scale, y: 0 }, opts).kind, null);
  }
  const opts = {
    scale: 1,
    gridMm: 100,
    grid: true,
    axes: true,
    vertices: [],
    anchor: { x: 0, y: 0 },
  };
  assert.equal(snapPoint({ x: 30, y: 5 }, opts).kind, "horizontal");
  assert.equal(snapPoint({ x: 5, y: 30 }, opts).kind, "vertical");
  assert.equal(
    snapPoint({ x: 95, y: 96 }, { ...opts, axes: false }).kind,
    "grid",
  );
  assert.equal(snapPoint({ x: 50, y: 50 }, opts).kind, null);
  assert.equal(
    segmentDistance({ x: 4, y: 3 }, { x: 0, y: 0 }, { x: 8, y: 0 }),
    3,
  );
});
test("fit centers negative bounds and does not crop extremely large drawings", () => {
  const f = fitViewport(
    [
      { x: -1000, y: -500 },
      { x: 1000, y: 500 },
    ],
    500,
    300,
    20,
  );
  assert.equal(f.scale, 0.23);
  assert.equal(f.x, 250);
  assert.equal(f.y, 150);
  assert.equal(fitViewport([{ x: 0, y: 0 }], 500, 300).scale, 2);
  assert.deepEqual(fitViewport([], 500, 300), { scale: 0.08, x: 40, y: 40 });
  assert.equal(
    fitViewport(
      [
        { x: -1e8, y: 0 },
        { x: 1e8, y: 0 },
      ],
      500,
      300,
    ).scale,
    420 / 2e8,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  areaReport,
  validateRing,
  resizeEdge,
  signedArea,
  type Ring,
} from "../src/modules/geometry/engine";
const ring = (xy: [number, number][], closed = true): Ring => ({
  points: xy.map(([x, y]) => ({ x, y })),
  closed,
});
const square = (x = 0, y = 0, s = 10000) =>
  ring([
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
  ]);
test("literal areas, union and boundary holes", () => {
  assert.equal(areaReport(square(), []).netM2, 100);
  assert.equal(areaReport(square(), [square(1000, 1000, 2000)]).netM2, 96);
  assert.equal(
    areaReport(
      ring([
        [0, 0],
        [10000, 0],
        [10000, 4000],
        [4000, 4000],
        [4000, 10000],
        [0, 10000],
      ]),
      [],
    ).netM2,
    64,
  );
  assert.equal(
    areaReport(square(), [square(1000, 1000, 2000), square(5000, 5000, 2000)])
      .netM2,
    92,
  );
  assert.equal(
    areaReport(square(), [square(1000, 1000, 2000), square(2000, 1000, 2000)])
      .netM2,
    94,
  );
  assert.equal(
    areaReport(square(), [square(1000, 1000, 4000), square(2000, 2000, 1000)])
      .netM2,
    84,
  );
  assert.equal(areaReport(square(), [square(0, 0, 2000)]).netM2, 96);
  assert.equal(areaReport(square(), []).perimeterM, 40);
});
test("rejects incomplete and invalid rings with null results", () => {
  const invalid = [
    ring(
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      false,
    ),
    ring([
      [0, 0],
      [2, 2],
      [0, 2],
      [2, 0],
    ]),
    ring([
      [0, 0],
      [1, 0],
      [1, 0],
      [0, 1],
    ]),
    ring([
      [0, 0],
      [1, 0],
      [2, 0],
    ]),
    ring([
      [0, 0],
      [Infinity, 0],
      [0, 1],
    ]),
    ring([
      [0, 0],
      [1e9, 0],
      [0, 1],
    ]),
    ring([
      [0, 0],
      [4, 0],
      [4, 4],
      [2, 0],
      [0, 4],
    ]),
  ];
  for (const r of invalid) {
    assert.ok(validateRing(r).length);
    assert.deepEqual(
      { ...areaReport(r, []), errors: [] },
      {
        valid: false,
        errors: [],
        grossM2: null,
        excludedM2: null,
        netM2: null,
        perimeterM: null,
      },
    );
  }
  assert.equal(areaReport(null, []).valid, false);
  assert.equal(areaReport(square(), [square(9000, 9000, 2000)]).valid, false);
  const l = ring([
    [0, 0],
    [10000, 0],
    [10000, 4000],
    [4000, 4000],
    [4000, 10000],
    [0, 10000],
  ]);
  assert.equal(
    areaReport(l, [
      ring([
        [1000, 8000],
        [8000, 1000],
        [2000, 1000],
      ]),
    ]).valid,
    false,
  );
  assert.equal(areaReport(square(-10000, -10000), []).netM2, 100);
  assert.equal(signedArea(square(99980000, 99980000).points), 100000000);
});
test("edge resizing preserves direction, fixed endpoint and recalculates", () => {
  const p = square().points;
  const changed = resizeEdge(p, true, 0, 12000, "start");
  assert.deepEqual(changed[0], p[0]);
  assert.deepEqual(changed[1], { x: 12000, y: 0 });
  assert.equal(areaReport({ points: changed, closed: true }, []).netM2, 110);
  assert.equal(p[1]!.x, 10000);
  assert.deepEqual(resizeEdge(p, true, 0, 8000, "end")[0], { x: 2000, y: 0 });
  assert.throws(() => resizeEdge(p, true, 0, -1, "start"));
  assert.throws(() => resizeEdge(p, true, 0, 1e10, "start"));
  assert.deepEqual(
    resizeEdge(
      [
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ],
      false,
      0,
      10,
      "start",
    )[1],
    { x: 6, y: 8 },
  );
});

test("reversed winding and precision are retained without rounding", () => {
  const outer = square();
  const reversed = { ...outer, points: [...outer.points].reverse() };
  assert.equal(areaReport(reversed, [square(1000, 1000, 2000)]).netM2, 96);
  const fractional = areaReport(square(0, 0, 1000.123), []);
  assert.ok(Math.abs(fractional.netM2! - 1.000246015129) < 1e-12);
  assert.throws(() =>
    resizeEdge(
      ring([
        [0, 0],
        [10000, 0],
        [10000, 4000],
        [4000, 4000],
        [4000, 10000],
        [0, 10000],
      ]).points,
      true,
      2,
      12000,
      "start",
    ),
  );
  const touching = ring([
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
    [4, 0],
  ]);
  assert.ok(validateRing(touching).length);
});

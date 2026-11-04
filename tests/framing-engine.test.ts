import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyDrawing } from "../src/modules/drawing/model";
import { defaultFramingSettings } from "../src/modules/framing/config";
import {
  generateFraming,
  refreshFraming,
  sourceGeometrySignature,
} from "../src/modules/framing/engine";
import { containsSegment } from "../src/modules/framing/geometry";
const rect = (w = 6000, h = 4000, x = 0) => ({
  ...emptyDrawing(),
  paths: [
    {
      id: "o",
      name: "Deck",
      role: "outer" as const,
      closed: true,
      points: [
        { x, y: 0 },
        { x: x + w, y: 0 },
        { x: x + w, y: h },
        { x, y: h },
      ],
    },
  ],
});
const meta = { id: "p", projectId: "d", now: "2026-11-05" };
test("continuous deterministic two layer geometry and exact lengths", () => {
  const d = rect();
  const s = { ...defaultFramingSettings(), lowerSpacingMm: 1000 };
  const p = generateFraming(d, s, meta);
  assert.deepEqual(p, generateFraming(d, s, meta));
  assert.equal(p.members.filter((m) => m.layer === "upper").length, 21);
  for (const m of p.members) {
    assert.equal(
      m.lengthMm,
      Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y),
    );
    assert(containsSegment(d, m.start, m.end));
    assert.equal(m.zBottomMm, m.layer === "lower" ? 0 : 60);
  }
  assert(p.members.some((m) => m.layer === "upper" && m.lengthMm === 4000));
});
for (const width of [3000, 4500, 6000, 7500])
  test(`actual shifted row pieces ${width}`, () => {
    const d = rect(width, 400, 100);
    const s = {
      ...defaultFramingSettings(),
      boardWidthMm: 100,
      boardGapMm: 5,
      edgeGapMm: 10,
      jointGapMm: 8,
      installationGapMm: 4,
    };
    const p = generateFraming(d, s, meta);
    assert.equal(p.rows[0]!.start.x, 110);
    assert.equal(p.pieces[0]!.start.x, 110);
    assert.equal(p.pieces[0]!.end.x, Math.min(3110, width + 90));
    for (const j of p.joints) {
      assert.equal(j.supportIds.length, 2);
      assert(j.verified);
    }
    const id = p.pieces[0]!.startSupportId;
    const q = refreshFraming(
      { ...p, members: p.members.filter((m) => m.id !== id) },
      d,
    );
    assert(q.warnings.some((w) => w.code === "DECK_END_UNSUPPORTED"));
  });
test("signature excludes presentation and includes exact geometry", () => {
  const d = rect();
  assert.equal(
    sourceGeometrySignature(d),
    sourceGeometrySignature({ ...d, layers: { ...d.layers, outer: false } }),
  );
  assert.notEqual(
    sourceGeometrySignature(d),
    sourceGeometrySignature(rect(6001)),
  );
});
const polygon = (points: number[][]) => ({
  ...emptyDrawing(),
  paths: [
    {
      id: "o",
      name: "Deck",
      role: "outer" as const,
      closed: true,
      points: points.map(([x, y]) => ({ x: x!, y: y! })),
    },
  ],
});
for (const [name, d] of [
  ["10m", rect(10000, 10000)],
  [
    "L",
    polygon([
      [0, 0],
      [6000, 0],
      [6000, 2000],
      [3000, 2000],
      [3000, 4000],
      [0, 4000],
    ]),
  ],
  [
    "U",
    polygon([
      [0, 0],
      [6000, 0],
      [6000, 4000],
      [4000, 4000],
      [4000, 2000],
      [2000, 2000],
      [2000, 4000],
      [0, 4000],
    ]),
  ],
] as const)
  test(`${name} exact clipped geometry`, () => {
    const p = generateFraming(
      d,
      { ...defaultFramingSettings(), lowerSpacingMm: 1000 },
      meta,
    );
    for (const m of p.members) {
      assert(containsSegment(d, m.start, m.end));
      assert.equal(
        m.lengthMm,
        Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y),
      );
    }
    assert(!p.warnings.some((w) => w.code === "UPPER_SPACING_EXCEEDED"));
  });
test("overlapping holes are union subtracted; rows restart from hole face", () => {
  const d = rect(7500, 1000, 100);
  for (const [i, a, b] of [
    [1, 2000, 3500],
    [2, 3000, 4000],
    [3, 5000, 5500],
  ])
    d.paths.push({
      id: `h${i}`,
      name: "Hole",
      role: "void" as "outer",
      closed: true,
      points: [
        { x: a!, y: 0 },
        { x: b!, y: 0 },
        { x: b!, y: 1000 },
        { x: a!, y: 1000 },
      ],
    });
  const p = generateFraming(
    d,
    {
      ...defaultFramingSettings(),
      boardWidthMm: 100,
      boardGapMm: 5,
      edgeGapMm: 10,
      jointGapMm: 8,
      installationGapMm: 4,
    },
    meta,
  );
  assert.deepEqual(
    p.rows.slice(0, 3).map((r) => [Math.round(r.start.x), Math.round(r.end.x)]),
    [
      [110, 1990],
      [4010, 4990],
      [5510, 7590],
    ],
  );
  for (const m of p.members) assert(containsSegment(d, m.start, m.end));
});
test("vertical rotation, stock flags and refresh preserve edited coordinates", () => {
  const d = rect(10000, 10000),
    p = generateFraming(
      d,
      {
        ...defaultFramingSettings(),
        deckDirection: "vertical",
        lowerSpacingMm: 1000,
      },
      meta,
    );
  const m = p.members.find((m) => m.layer === "upper")!;
  assert.equal(m.start.y, m.end.y);
  assert(m.requiresSplice);
  assert(p.splices.every((s) => s.at === null && !s.designed));
  const moved = { ...m, start: { x: m.start.x + 7, y: m.start.y } };
  const q = refreshFraming(
    { ...p, members: [moved, ...p.members.filter((n) => n.id !== m.id)] },
    d,
  );
  assert.deepEqual(q.members[0]!.start, moved.start);
  assert.equal(q.members.length, p.members.length);
});
test("invalid settings, outside holes and resource excess reject deterministically", () => {
  assert.throws(() =>
    generateFraming(
      rect(),
      { ...defaultFramingSettings(), upperMaxSpacingMm: 0 },
      meta,
    ),
  );
  assert.throws(() =>
    generateFraming(
      rect(),
      { ...defaultFramingSettings(), upperMaxSpacingMm: 0.001 },
      meta,
    ),
  );
  const d = rect();
  d.paths.push({
    id: "h",
    name: "outside",
    role: "void" as "outer",
    closed: true,
    points: [
      { x: 7000, y: 0 },
      { x: 8000, y: 0 },
      { x: 8000, y: 100 },
      { x: 7000, y: 100 },
    ],
  });
  assert.throws(() => generateFraming(d, defaultFramingSettings(), meta));
});
test("double support disabled produces explicit unsupported seam and manual removal detects spacing", () => {
  const d = rect(),
    s = {
      ...defaultFramingSettings(),
      boardWidthMm: 100,
      boardGapMm: 5,
      edgeGapMm: 10,
      jointGapMm: 8,
      installationGapMm: 4,
      doubleJointSupport: false,
    },
    p = generateFraming(d, s, meta);
  assert(p.joints.every((j) => !j.verified));
  assert(p.warnings.some((w) => w.code === "DOUBLE_SUPPORT_DISABLED"));
  const basic = generateFraming(d, defaultFramingSettings(), meta);
  const q = refreshFraming(
    {
      ...basic,
      members: basic.members.filter(
        (m) => !(m.layer === "upper" && m.start.x === 300),
      ),
    },
    d,
  );
  assert(q.warnings.some((w) => w.code === "UPPER_SPACING_EXCEEDED"));
});
test("support faces touch deck endpoints and installation clearance is explicit feasibility", () => {
  const d = rect(6000, 400),
    s = {
      ...defaultFramingSettings(),
      boardWidthMm: 100,
      boardGapMm: 5,
      edgeGapMm: 10,
      jointGapMm: 5,
      installationGapMm: 3,
    };
  const p = generateFraming(d, s, meta),
    j = p.joints[0]!,
    left = p.pieces.find((q) => q.id === j.leftPieceId)!,
    right = p.pieces.find((q) => q.id === j.rightPieceId)!;
  assert(j.verified);
  assert.equal(
    p.members.find((m) => m.id === left.endSupportId)!.start.x,
    2990,
  );
  assert.equal(
    p.members.find((m) => m.id === right.startSupportId)!.start.x,
    3035,
  );
  const q = generateFraming(d, { ...s, installationGapMm: 6 }, meta);
  assert(q.joints.every((j) => !j.verified));
  assert(q.warnings.some((w) => w.code === "JOINT_CLEARANCE_INCOMPATIBLE"));
});
test("refresh preserves deleted/edited feet and generic diagonal contacts", () => {
  const d = rect(),
    p = generateFraming(
      d,
      {
        ...defaultFramingSettings(),
        lowerSpacingMm: 1000,
        supportSpacingMm: 1000,
      },
      meta,
    );
  const foot = p.supports[1]!;
  const q = refreshFraming(
    { ...p, supports: p.supports.filter((s) => s.id !== foot.id) },
    d,
  );
  assert(!q.supports.some((s) => s.id === foot.id));
  assert(q.warnings.some((w) => w.code === "SUPPORT_SPACING_EXCEEDED"));
  const upper = p.members.find((m) => m.layer === "upper")!;
  const r = refreshFraming(
    {
      ...p,
      members: p.members.map((m) =>
        m.id === upper.id
          ? { ...m, start: { x: 100, y: 0 }, end: { x: 4100, y: 4000 } }
          : m,
      ),
    },
    d,
  );
  assert(
    r.connections.some(
      (c) =>
        c.memberIds.includes(upper.id) && c.at.x === 1100 && c.at.y === 1000,
    ),
  );
});
test("dense contact grids reject by explicit pair budget", () => {
  assert.throws(
    () =>
      generateFraming(
        rect(6000, 6000),
        {
          ...defaultFramingSettings(),
          upperMaxSpacingMm: 20,
          lowerSpacingMm: 20,
        },
        meta,
      ),
    /hesap sınırı/,
  );
});
test("partial-width and irregular board coverage warn conservatively", () => {
  const s = {
    ...defaultFramingSettings(),
    boardWidthMm: 100,
    boardGapMm: 5,
    edgeGapMm: 10,
    jointGapMm: 5,
    installationGapMm: 3,
  };
  const p = generateFraming(rect(6000, 400), s, meta);
  assert(p.warnings.some((w) => w.code === "DECK_COVERAGE_INCOMPLETE"));
});
test("diagonal endpoint edit invalidates joint proof and cannot conceal spacing gap", () => {
  const d = rect(6000, 400),
    s = {
      ...defaultFramingSettings(),
      boardWidthMm: 100,
      boardGapMm: 5,
      edgeGapMm: 10,
      jointGapMm: 5,
      installationGapMm: 3,
    },
    p = generateFraming(d, s, meta),
    joint = p.joints[0]!,
    id = joint.supportIds[0]!;
  assert(joint.verified);
  const q = refreshFraming(
    {
      ...p,
      members: p.members.map((m) =>
        m.id === id ? { ...m, end: { x: m.end.x + 100, y: m.end.y } } : m,
      ),
    },
    d,
  );
  assert(q.warnings.some((w) => w.code === "DECK_END_UNSUPPORTED"));
  assert(
    q.joints.filter((j) => j.supportIds.includes(id)).every((j) => !j.verified),
  );
  const basic = generateFraming(rect(), defaultFramingSettings(), meta);
  const r = refreshFraming(
    {
      ...basic,
      members: basic.members.map((m) =>
        m.layer === "upper" && m.start.x === 300
          ? { ...m, end: { x: 350, y: m.end.y } }
          : m,
      ),
    },
    rect(),
  );
  assert(r.warnings.some((w) => w.code === "UPPER_SPACING_EXCEEDED"));
  assert(r.warnings.some((w) => w.code === "UPPER_SPACING_UNPROVEN"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectRepository, type SqlDatabase } from "../src/core/db/repository";
import {
  createCuttingPlan,
  parseCutting,
} from "../src/modules/cutting/persistence";
import { emptyDrawing } from "../src/modules/drawing/model";
import { sourceGeometrySignature } from "../src/modules/framing/engine";
import { member, plan } from "./cutting-fixtures";
function connect(file: string) {
  const sqlite = new DatabaseSync(file);
  const db: SqlDatabase = {
    execAsync: async (sql) => {
      sqlite.exec(sql);
    },
    runAsync: async (sql, ...args) => ({
      changes: Number(sqlite.prepare(sql).run(...args).changes),
    }),
    getAllAsync: async <T>(sql: string, ...args: (string | number | null)[]) =>
      sqlite.prepare(sql).all(...args) as T[],
  };
  return { sqlite, db, repo: new ProjectRepository(db) };
}
async function setup(c: ReturnType<typeof connect>) {
  await c.repo.init();
  const project = await c.repo.save({
    name: "Cutting",
    city: "İzmir",
    district: "Urla",
    customer: "",
    description: "",
    type: "Deck",
  });
  const drawing = emptyDrawing();
  await c.repo.saveDrawing(project.id, drawing);
  const p = {
    ...plan([member("a", 3000)]),
    projectId: project.id,
    sourceGeometry: sourceGeometrySignature(drawing),
  };
  await c.repo.saveFraming(p);
  return { p, drawing };
}
test("v3 migration preserves framing, cutting and inventory survive a real SQLite reopen", async () => {
  const folder = await mkdtemp(join(tmpdir(), "deckaft-cutting-"));
  const file = join(folder, "studio.sqlite");
  let c = connect(file);
  try {
    const { p } = await setup(c);
    const cut = createCuttingPlan(
      p,
      {},
      { id: "cut1", now: "2026-11-05T10:00:00.000Z" },
    );
    await c.repo.saveCutting(cut);
    c.sqlite.close();
    c = connect(file);
    await c.repo.init();
    assert.deepEqual(await c.repo.getCutting(p.projectId), cut);
    assert.equal(
      c.sqlite.prepare("PRAGMA user_version").get()?.user_version,
      3,
    );
    assert.equal((await c.repo.getFraming(p.projectId))?.id, p.id);
    const inventory = await c.repo.listRemnants(p.projectId);
    assert.equal(inventory.length, 1);
    assert.equal(inventory[0]?.status, "available");
    assert.equal(inventory[0]?.section.wallMm, 2);
    await c.repo.delete(p.projectId);
    assert.equal(
      c.sqlite.prepare("SELECT count(*) n FROM cutting_plans").get()?.n,
      0,
    );
  } finally {
    c.sqlite.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("same timestamp framing edits invalidate cutting and disable available remnants", async () => {
  const c = connect(":memory:");
  try {
    const { p } = await setup(c);
    const cut = createCuttingPlan(
      p,
      {},
      { id: "cut", now: "2026-11-05T10:00:00Z" },
    );
    await c.repo.saveCutting(cut);
    await c.repo.saveFraming({ ...p, members: [member("a", 2500)] });
    assert.equal((await c.repo.getCutting(p.projectId))?.stale, true);
    assert.equal((await c.repo.listRemnants(p.projectId))[0]?.status, "stale");
    await assert.rejects(c.repo.saveCutting(cut), /değiş|güncel/i);
  } finally {
    c.sqlite.close();
  }
});
test("drawing edits invalidate old cutting even when framing row is unchanged", async () => {
  const c = connect(":memory:");
  try {
    const { p, drawing } = await setup(c);
    await c.repo.saveCutting(
      createCuttingPlan(p, {}, { id: "cut", now: "2026-11-05T10:00:00Z" }),
    );
    await c.repo.saveDrawing(p.projectId, {
      ...drawing,
      paths: [
        {
          id: "outer",
          role: "outer",
          name: "Deck",
          closed: false,
          points: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
          ],
        },
      ],
    });
    assert.equal((await c.repo.getCutting(p.projectId))?.stale, true);
  } finally {
    c.sqlite.close();
  }
});
test("source compare is atomic if framing changes during save", async () => {
  const c = connect(":memory:");
  try {
    const { p } = await setup(c);
    const cut = createCuttingPlan(
      p,
      {},
      { id: "cut", now: "2026-11-05T10:00:00Z" },
    );
    const real = c.db.runAsync;
    c.db.runAsync = async (sql, ...params) => {
      if (sql.startsWith("INSERT INTO cutting_plans"))
        c.sqlite
          .prepare("UPDATE framing_plans SET document=? WHERE projectId=?")
          .run(
            JSON.stringify({ ...p, members: [member("a", 2000)] }),
            p.projectId,
          );
      return real(sql, ...params);
    };
    await assert.rejects(c.repo.saveCutting(cut), /değiş/i);
    assert.equal(await c.repo.getCutting(p.projectId), null);
  } finally {
    c.sqlite.close();
  }
});
test("persisted cut decoder rejects forged fabrication approval, missing pieces and material imbalance", () => {
  const p = plan([member("a", 3000)]);
  const cut = createCuttingPlan(
    p,
    {},
    { id: "cut", now: "2026-11-05T10:00:00Z" },
  );
  assert.deepEqual(parseCutting(JSON.stringify(cut)), cut);
  for (const change of [
    { validForFabrication: true },
    { totalWasteMm: 0 },
    { remnants: [] },
    { stocks: [{ ...cut.stocks[0], pieces: [] }] },
    { sourcePlanId: "wrong" },
  ])
    assert.throws(() => parseCutting(JSON.stringify({ ...cut, ...change })));
});

test("fractional manufacturing settings normalize idempotently through save and reopen", () => {
  const p = plan([member("a", 1000)]);
  const cut = createCuttingPlan(
    p,
    { cutKerfMm: 2.0061, startTrimMm: 4.0121, stockLengthMm: 6000.007 },
    { id: "fractional", now: "2026-11-05T10:00:00Z" },
  );
  assert.equal(cut.cutKerfMm, 2.007);
  assert.equal(cut.settings.startTrimMm, 4.013);
  assert.equal(cut.stockLengthMm, 6000.007);
  assert.deepEqual(parseCutting(JSON.stringify(cut)), cut);
});

test("decoder rejects a self-consistent but false optimality certificate", () => {
  const source = plan(
    [3600, 3000, 1800, 1200, 1200, 1200].map((n, i) => member(String(i), n)),
  );
  source.settings.kerfMm = 0;
  const raw = {
    ...createCuttingPlan(
      source,
      { maxSearchNodes: 0 },
      { id: "unproven", now: "2026-11-05T10:00:00Z" },
    ),
  };
  assert.equal(raw.stocks.length, 3);
  const forged = {
    ...raw,
    optimizationStatus: "optimal",
    minimumStockCount: 3,
    stockLowerBound: 3,
    qualityRatio: 1,
    groups: raw.groups.map((g) => ({
      ...g,
      optimizationStatus: "optimal",
      stockLowerBound: 3,
    })),
  };
  assert.throws(() => parseCutting(JSON.stringify(forged)));
});

test("a conservative saved lower bound remains valid when a later replay proves a stronger bound", () => {
  const source = plan(
    Array.from({ length: 5 }, (_, i) => member(String(i), 2100)),
  );
  source.settings.kerfMm = 0;
  const cut = createCuttingPlan(
    source,
    { maxSearchNodes: 0 },
    { id: "bounded", now: "2026-11-05T10:00:00Z" },
  );
  assert.equal(cut.stocks.length, 3);
  assert.ok(parseCutting(JSON.stringify(cut)).stockLowerBound <= 3);
});

test("unverified saved feasible lower bounds are capped to independently established bounds", () => {
  const source = plan(
    Array.from({ length: 20 }, (_, j) =>
      [3600, 3000, 1800, 1200, 1200, 1200].map((n, i) =>
        member(`${j}-${i}`, n),
      ),
    ).flat(),
  );
  source.settings.kerfMm = 0;
  const cut = createCuttingPlan(
    source,
    { maxSearchNodes: 0 },
    { id: "large", now: "2026-11-05T10:00:00Z" },
  );
  assert.equal(cut.stockLowerBound, 40);
  assert.equal(cut.stocks.length, 42);
  const forged = {
    ...cut,
    stockLowerBound: 41,
    qualityRatio: 42 / 41,
    groups: cut.groups.map((g) => ({ ...g, stockLowerBound: 41 })),
  };
  assert.equal(parseCutting(JSON.stringify(forged)).stockLowerBound, 40);
});

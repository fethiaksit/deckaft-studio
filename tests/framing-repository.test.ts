import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectRepository, type SqlDatabase } from "../src/core/db/repository";
import {
  emptyDrawing,
  type DrawingDocument,
} from "../src/modules/drawing/model";
import { defaultFramingSettings } from "../src/modules/framing/config";
import { generateFraming } from "../src/modules/framing/engine";
import { parseFraming } from "../src/modules/framing/persistence";
const doc: DrawingDocument = {
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
function connect(file: string) {
  const sqlite = new DatabaseSync(file);
  const db: SqlDatabase = {
    execAsync: async (sql) => {
      sqlite.exec(sql);
    },
    runAsync: async (sql, ...params) => {
      const result = sqlite.prepare(sql).run(...params);
      return { changes: Number(result.changes) };
    },
    getAllAsync: async <T>(
      sql: string,
      ...params: (string | number | null)[]
    ) => sqlite.prepare(sql).all(...params) as T[],
  };
  return { sqlite, repo: new ProjectRepository(db) };
}
test("schema migration preserves legacy projects/drawings and framing survives actual SQLite reopen", async () => {
  const folder = await mkdtemp(join(tmpdir(), "deckaft-frame-"));
  const file = join(folder, "studio.sqlite");
  let c = connect(file);
  try {
    c.sqlite.exec(
      "CREATE TABLE projects(id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,customer TEXT NOT NULL,city TEXT NOT NULL,district TEXT NOT NULL,description TEXT NOT NULL,type TEXT NOT NULL,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);CREATE TABLE drawings(projectId TEXT PRIMARY KEY NOT NULL REFERENCES projects(id) ON DELETE CASCADE,document TEXT NOT NULL,updatedAt TEXT NOT NULL);PRAGMA user_version=1;",
    );
    c.sqlite
      .prepare("INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?)")
      .run(
        "legacy",
        "Eski proje",
        "",
        "İzmir",
        "Urla",
        "",
        "Deck",
        "2026-01-01",
        "2026-01-01",
      );
    const legacy = { version: 1, unit: "mm", paths: [], dimensions: [] };
    c.sqlite
      .prepare("INSERT INTO drawings VALUES (?,?,?)")
      .run("legacy", JSON.stringify(legacy), "2026-01-01");
    await c.repo.init();
    await c.repo.init();
    assert.equal(
      c.sqlite.prepare("PRAGMA user_version").get()?.user_version,
      2,
    );
    assert.equal((await c.repo.list()).length, 1);
    assert.equal((await c.repo.getDrawing("legacy")).version, 2);
    assert.equal(
      c.sqlite.prepare("SELECT document FROM drawings").get()?.document,
      JSON.stringify(legacy),
    );
    await c.repo.saveDrawing("legacy", doc);
    const p = generateFraming(
      doc,
      { ...defaultFramingSettings(), lowerSpacingMm: 1000 },
      { id: "f", projectId: "legacy", now: "2026-11-05T00:00:00.000Z" },
    );
    await c.repo.saveFraming(p);
    c.sqlite.close();
    c = connect(file);
    await c.repo.init();
    assert.deepEqual(await c.repo.getFraming("legacy"), p);
    const changed = {
      ...doc,
      paths: doc.paths.map((path) => ({
        ...path,
        points: path.points.map((v, i) => (i === 1 ? { x: 6500, y: 0 } : v)),
      })),
    };
    await c.repo.saveDrawing("legacy", changed);
    assert.ok(
      (await c.repo.getFraming("legacy"))?.warnings.some(
        (w) => w.code === "STALE_SOURCE",
      ),
    );
    await assert.rejects(c.repo.saveFraming(p));
    await c.repo.delete("legacy");
    assert.equal(
      c.sqlite.prepare("SELECT count(*) as n FROM framing_plans").get()?.n,
      0,
    );
  } finally {
    c.sqlite.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("plan decoder rejects forged lengths, duplicate member codes and false production approval", () => {
  const p = generateFraming(doc, defaultFramingSettings(), {
    id: "p",
    projectId: "project",
    now: "2026-11-05T00:00:00.000Z",
  });
  assert.deepEqual(parseFraming(JSON.stringify(p)), p);
  const member = p.members[0]!;
  assert.throws(() =>
    parseFraming(
      JSON.stringify({ ...p, members: [{ ...member, lengthMm: 1 }] }),
    ),
  );
  assert.throws(() =>
    parseFraming(
      JSON.stringify({ ...p, members: [member, { ...member, id: "other" }] }),
    ),
  );
  assert.throws(() =>
    parseFraming(
      JSON.stringify({ ...p, members: [{ ...member, productionReady: true }] }),
    ),
  );
});

test("required kerf value cannot be forged as null and impossible board width is explicit", () => {
  const p = generateFraming(doc, defaultFramingSettings(), {
    id: "p",
    projectId: "project",
    now: "2026-11-05T00:00:00.000Z",
  });
  assert.throws(() =>
    parseFraming(
      JSON.stringify({ ...p, settings: { ...p.settings, kerfMm: null } }),
    ),
  );
  const impossible = generateFraming(
    doc,
    {
      ...defaultFramingSettings(),
      boardWidthMm: 10000,
      boardGapMm: 5,
      edgeGapMm: 10,
      jointGapMm: 5,
      installationGapMm: 3,
    },
    { id: "bad-row", projectId: "p", now: "2026-11-05T00:00:00.000Z" },
  );
  assert.equal(impossible.rows.length, 0);
  assert.ok(impossible.warnings.some((w) => w.code === "DECK_LAYOUT_EMPTY"));
});

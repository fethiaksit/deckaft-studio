import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectRepository, type SqlDatabase } from "../src/core/db/repository";
import { emptyDrawing, appendPoint } from "../src/modules/drawing/model";

function connect(file: string) {
  const sqlite = new DatabaseSync(file);
  const db: SqlDatabase = {
    execAsync: async (sql) => {
      sqlite.exec(sql);
    },
    runAsync: async (sql, ...params) => {
      const r = sqlite.prepare(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    getAllAsync: async <T>(
      sql: string,
      ...params: (string | number | null)[]
    ) => sqlite.prepare(sql).all(...params) as T[],
  };
  return { sqlite, repo: new ProjectRepository(db) };
}
const input = {
  name: "Urla 'Deck'; --",
  customer: "Ada",
  city: "İzmir",
  district: "Urla",
  description: "Deniz terası",
  type: "Deck" as const,
};

test("real SQLite CRUD, drawing persistence after reopen, and cascade deletion", async () => {
  const dir = await mkdtemp(join(tmpdir(), "deckaft-"));
  const file = join(dir, "studio.sqlite");
  let connection = connect(file);
  try {
    await connection.repo.init();
    await connection.repo.init();
    assert.deepEqual(await connection.repo.list(), []);
    const saved = await connection.repo.save(input);
    assert.equal((await connection.repo.get(saved.id))?.name, input.name);
    const drawing = appendPoint(emptyDrawing(), "p1", { x: 1200, y: 800 });
    await connection.repo.saveDrawing(saved.id, drawing);
    connection.sqlite.close();
    connection = connect(file);
    await connection.repo.init();
    assert.deepEqual(await connection.repo.getDrawing(saved.id), drawing);
    const updated = await connection.repo.save(
      { ...input, name: "Yeni teras" },
      saved.id,
    );
    assert.equal(updated.createdAt, saved.createdAt);
    assert.equal((await connection.repo.list())[0]?.name, "Yeni teras");
    await connection.repo.delete(saved.id);
    assert.equal(await connection.repo.get(saved.id), null);
    assert.equal(
      connection.sqlite.prepare("SELECT count(*) as n FROM drawings").get()?.n,
      0,
    );
    await assert.rejects(connection.repo.saveDrawing(saved.id, drawing));
  } finally {
    connection.sqlite.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("invalid input and editing a deleted project never create rows", async () => {
  const { sqlite, repo } = connect(":memory:");
  try {
    await repo.init();
    await assert.rejects(repo.save({ ...input, name: "" }));
    await assert.rejects(repo.save(input, "does-not-exist"));
    assert.deepEqual(await repo.list(), []);
  } finally {
    sqlite.close();
  }
});

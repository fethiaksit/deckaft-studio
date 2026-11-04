import { test } from "node:test";
import assert from "node:assert/strict";
import { createEditor, editorReducer } from "../src/modules/drawing/editor";
import { appendPoint, emptyDrawing } from "../src/modules/drawing/model";
test("undo then continue extends the same polyline and discards redo", () => {
  let editor = createEditor(emptyDrawing(), "path-one");
  for (const x of [0, 1000, 2000])
    editor = editorReducer(editor, {
      type: "document",
      document: appendPoint(editor.history.present, editor.pathId, { x, y: 0 }),
    });
  editor = editorReducer(editor, { type: "undo" });
  editor = editorReducer(editor, {
    type: "document",
    document: appendPoint(editor.history.present, editor.pathId, {
      x: 3000,
      y: 500,
    }),
  });
  assert.equal(editor.history.present.paths.length, 1);
  assert.deepEqual(editor.history.present.paths[0]?.points, [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 3000, y: 500 },
  ]);
  assert.equal(editor.history.future.length, 0);
});
test("redo preserves active path; explicit new line starts a separate one", () => {
  let editor = createEditor(
    appendPoint(emptyDrawing(), "one", { x: 0, y: 0 }),
    "one",
  );
  editor = editorReducer(editor, {
    type: "document",
    document: appendPoint(editor.history.present, "one", { x: 1000, y: 0 }),
  });
  editor = editorReducer(editorReducer(editor, { type: "undo" }), {
    type: "redo",
  });
  assert.equal(editor.pathId, "one");
  editor = editorReducer(editor, { type: "newPath", id: "two" });
  editor = editorReducer(editor, {
    type: "document",
    document: appendPoint(editor.history.present, editor.pathId, {
      x: 0,
      y: 1000,
    }),
  });
  assert.equal(editor.history.present.paths.length, 2);
});

test("undo reconciles an active region removed from document history", async () => {
  const { startRegion } = await import("../src/modules/drawing/operations");
  const doc = appendPoint(emptyDrawing(), "outer", { x: 0, y: 0 });
  let e = createEditor(doc, "outer");
  e = editorReducer(e, {
    type: "document",
    document: startRegion(doc, "new", "draft", "Yeni"),
  });
  e = editorReducer(e, { type: "newPath", id: "new" });
  e = editorReducer(e, { type: "undo" });
  assert.equal(e.pathId, "outer");
  assert.ok(e.history.present.paths.some((p) => p.id === e.pathId));
});

import { createHistory, commit, undo, redo, type History } from "./history";
import type { DrawingDocument } from "./model";
export interface DrawingEditor {
  history: History<DrawingDocument>;
  pathId: string;
}
export type EditorAction =
  | { type: "document"; document: DrawingDocument }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "newPath"; id: string }
  | { type: "load"; document: DrawingDocument; pathId: string };
export const createEditor = (
  document: DrawingDocument,
  pathId: string,
): DrawingEditor => ({ history: createHistory(document), pathId });
export function editorReducer(
  editor: DrawingEditor,
  action: EditorAction,
): DrawingEditor {
  switch (action.type) {
    case "load":
      return createEditor(action.document, action.pathId);
    case "document":
      return { ...editor, history: commit(editor.history, action.document) };
    case "undo":
      return { ...editor, history: undo(editor.history) };
    case "redo":
      return { ...editor, history: redo(editor.history) };
    case "newPath":
      return { ...editor, pathId: action.id };
  }
}

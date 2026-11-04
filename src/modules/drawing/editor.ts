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
    case "undo": {
      const history = undo(editor.history);
      const pathId = history.present.paths.some((p) => p.id === editor.pathId)
        ? editor.pathId
        : (history.present.paths.findLast((p) => !p.closed)?.id ??
          history.present.paths.at(-1)?.id ??
          editor.pathId);
      return { history, pathId };
    }
    case "redo": {
      const history = redo(editor.history);
      const restored = history.present.paths.find(
        (p) => !editor.history.present.paths.some((old) => old.id === p.id),
      );
      const pathId =
        restored?.id ??
        (history.present.paths.some((p) => p.id === editor.pathId)
          ? editor.pathId
          : (history.present.paths.at(-1)?.id ?? editor.pathId));
      return { history, pathId };
    }
    case "newPath":
      return { ...editor, pathId: action.id };
  }
}

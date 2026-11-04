import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Alert } from "react-native";
import { usePreventRemove } from "expo-router";
import { useRepository } from "../../../core/db/provider";
import { newId } from "../../../core/db/repository";
import { errorMessage } from "../../../core/store/projects";
import type { Project } from "../../projects/model";
import type { PointMm } from "../../geometry/model";
import {
  fitViewport,
  parseLength,
  snapPoint,
} from "../../geometry/interaction";
import {
  emptyDrawing,
  appendPoint,
  addDimension,
  type DrawingDocument,
  type DrawingTool,
  type PathRole,
  type VoidKind,
} from "../model";
import { createEditor, editorReducer } from "../editor";
import { DEFAULT_VIEWPORT, zoomAt } from "../coordinates";
import {
  closeRegion,
  startRegion,
  movePoint,
  editEdge,
  drawingArea,
  selectAt,
  deleteSelection,
  mergeVertex,
  updateRegion,
  pathVisible,
  type Selection,
} from "../operations";
import { DRAWING } from "../config";
export function useDrawingWorkspace(projectId: string) {
  const repo = useRepository();
  const [project, setProject] = useState<Project | null>(null);
  const [{ history, pathId }, dispatch] = useReducer(
    editorReducer,
    undefined,
    () => createEditor(emptyDrawing(), newId()),
  );
  const document = history.present;
  const [baseline, setBaseline] = useState(JSON.stringify(emptyDrawing()));
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  const [tool, setTool] = useState<DrawingTool>("draw");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [measureStart, setMeasureStart] = useState<PointMm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [panel, setPanel] = useState(false);
  const [preview, setPreview] = useState<DrawingDocument | null>(null);
  const [hint, setHint] = useState<ReturnType<typeof snapPoint> | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const busy = useRef(false);
  const drag = useRef<{
    document: DrawingDocument;
    pathId: string;
    index: number;
    point: PointMm;
  } | null>(null);
  const dirty = JSON.stringify(document) !== baseline;
  const fittedProject = useRef<string | null>(null);
  useEffect(() => {
    if (
      loading ||
      !size.width ||
      !size.height ||
      fittedProject.current === projectId
    )
      return;
    fittedProject.current = projectId;
    setViewport(
      fitViewport(
        document.paths
          .flatMap((p) => p.points)
          .concat(document.dimensions.flatMap((m) => [m.from, m.to])),
        size.width,
        size.height,
      ),
    );
  }, [loading, projectId, size.width, size.height, document]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    void Promise.all([repo.get(projectId), repo.getDrawing(projectId)])
      .then(([p, d]) => {
        if (!active) return;
        if (!p) throw new Error("Proje bulunamadı.");
        setProject(p);
        const open = d.paths.find((p) => !p.closed);
        dispatch({
          type: "load",
          document: d,
          pathId: open?.id ?? d.paths.at(-1)?.id ?? newId(),
        });
        setBaseline(JSON.stringify(d));
        setTool(d.paths.length && !open ? "select" : "draw");
        setSelection(null);
        setPreview(null);
        setMeasureStart(null);
        setSaved(false);
      })
      .catch((e) => {
        if (active) setLoadError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repo, projectId, attempt]);
  usePreventRemove(dirty || saving, ({ repeat }) => {
    if (busy.current) {
      Alert.alert(
        "Kayıt sürüyor",
        "Kayıt tamamlandıktan sonra çıkabilirsiniz.",
      );
      return;
    }
    Alert.alert(
      "Çizim kaydedilmedi",
      "Son değişiklikleri bırakıp çıkmak istiyor musunuz?",
      [
        { text: "Çizime dön", style: "cancel" },
        {
          text: "Kaydetmeden çık",
          style: "destructive",
          onPress: () => {
            setBaseline(JSON.stringify(document));
            repeat();
          },
        },
      ],
    );
  });
  const report = useMemo(
    () =>
      preview
        ? {
            valid: false,
            errors: [
              "Köşe taşıma önizlemesi; bırakıldığında alan güncellenecek.",
            ],
            grossM2: null,
            excludedM2: null,
            netM2: null,
            perimeterM: null,
          }
        : drawingArea(document),
    [document, preview],
  );
  const activePath = document.paths.find((p) => p.id === pathId);
  const selectedPath =
    selection && selection.kind !== "dimension"
      ? document.paths.find((p) => p.id === selection.pathId)
      : undefined;
  function apply(next: DrawingDocument) {
    if (busy.current) return;
    dispatch({ type: "document", document: next });
    setSaved(false);
    setError("");
    setPreview(null);
  }
  function perform(action: () => void) {
    if (busy.current) return;
    try {
      action();
      setError("");
    } catch (e) {
      setError(errorMessage(e));
      setPreview(null);
    }
  }
  function snap(raw: PointMm, path = activePath, excludeIndex?: number) {
    const vertices = document.snap.vertices
      ? document.paths
          .filter((p) => pathVisible(document, p))
          .flatMap((p) =>
            p.points.filter(
              (_, i) =>
                !(
                  p.id === path?.id &&
                  (i === excludeIndex ||
                    (excludeIndex === undefined && i === p.points.length - 1))
                ),
            ),
          )
      : [];
    const anchor =
      excludeIndex === undefined
        ? path?.points.at(-1)
        : path?.points[
            (excludeIndex - 1 + path.points.length) % path.points.length
          ];
    return snapPoint(raw, {
      scale: viewport.scale,
      gridMm: document.snap.gridMm,
      grid: document.snap.grid,
      axes: document.snap.axes,
      vertices,
      anchor,
      tolerancePx: DRAWING.snapTolerancePx,
    });
  }
  function changeTool(value: DrawingTool) {
    if (value === "draw" || value === "measure" || value === "pan")
      setSelection(null);
    setTool(value);
    setMeasureStart(null);
    setHint(null);
    setPreview(null);
    drag.current = null;
  }
  function point(raw: PointMm, withSnap = true) {
    perform(() => {
      if (tool === "draw") {
        if (activePath && !pathVisible(document, activePath))
          throw new Error("Aktif alanın katmanını görünür yapın.");
        const result = withSnap ? snap(raw) : { point: raw, kind: null };
        setHint(result);
        const first = activePath?.points[0];
        const close =
          activePath &&
          !activePath.closed &&
          activePath.points.length >= 3 &&
          first &&
          (withSnap
            ? Math.hypot(raw.x - first.x, raw.y - first.y) <=
              DRAWING.snapTolerancePx / viewport.scale
            : raw.x === first.x && raw.y === first.y);
        if (close) {
          apply(closeRegion(document, pathId));
          setSelection({ kind: "edge", pathId, index: 0 });
          changeTool("select");
        } else apply(appendPoint(document, pathId, result.point));
      } else if (tool === "measure") {
        if (!document.layers.dimensions)
          throw new Error("Ölçü katmanını görünür yapın.");
        const result = withSnap ? snap(raw) : { point: raw, kind: null };
        setHint(result);
        if (measureStart) {
          apply(addDimension(document, newId(), measureStart, result.point));
          setMeasureStart(null);
        } else setMeasureStart(result.point);
      } else {
        const next = selectAt(document, raw, viewport.scale, tool === "move");
        setSelection(next);
        if (next) {
          if (next.kind !== "dimension")
            dispatch({ type: "newPath", id: next.pathId });
          setPanel(true);
        }
      }
    });
  }
  function newRegion(role: PathRole, name: string, kind?: VoidKind) {
    perform(() => {
      const id = newId();
      apply(startRegion(document, id, role, name, kind));
      dispatch({ type: "newPath", id });
      setSelection(null);
      changeTool("draw");
    });
  }
  function close() {
    perform(() => {
      apply(closeRegion(document, pathId));
      setSelection({ kind: "edge", pathId, index: 0 });
      changeTool("select");
    });
  }
  function resize(text: string, fixed: "start" | "end") {
    perform(() => {
      if (selection?.kind !== "edge") throw new Error("Önce bir kenar seçin.");
      apply(
        editEdge(
          document,
          selection.pathId,
          selection.index,
          parseLength(text),
          fixed,
        ),
      );
    });
  }
  function move(point: PointMm) {
    perform(() => {
      if (selection?.kind !== "vertex") throw new Error("Önce bir köşe seçin.");
      apply(movePoint(document, selection.pathId, selection.index, point));
    });
  }
  function merge() {
    perform(() => {
      if (selection?.kind !== "vertex") throw new Error("Önce bir köşe seçin.");
      apply(
        mergeVertex(
          document,
          selection.pathId,
          selection.index,
          DRAWING.snapTolerancePx / viewport.scale,
        ),
      );
      setSelection(null);
    });
  }
  function remove() {
    perform(() => {
      if (!selection) return;
      apply(deleteSelection(document, selection));
      setSelection(null);
      setMeasureStart(null);
    });
  }
  function properties(values: Parameters<typeof updateRegion>[2]) {
    perform(() => {
      const id = selectedPath?.id ?? activePath?.id;
      if (!id) throw new Error("Önce bir alan seçin.");
      apply(updateRegion(document, id, values));
    });
  }
  function updateSettings(
    next: Partial<Pick<DrawingDocument, "layers" | "snap">>,
  ) {
    perform(() => {
      const doc = { ...document, ...next };
      if (
        !Number.isFinite(doc.snap.gridMm) ||
        doc.snap.gridMm < DRAWING.minGridMm ||
        doc.snap.gridMm > DRAWING.maxGridMm
      )
        throw new Error("Izgara aralığı 1–1000000 mm arasında olmalı.");
      apply(doc);
      setSelection(null);
      setHint(null);
    });
  }
  function historyStep(type: "undo" | "redo") {
    if (busy.current) return;
    dispatch({ type });
    setSelection(null);
    setMeasureStart(null);
    setPreview(null);
    setHint(null);
    drag.current = null;
    setSaved(false);
    setError("");
  }
  function dragStart(raw: PointMm) {
    if (busy.current) return;
    const selected = selectAt(document, raw, viewport.scale, true);
    if (selected?.kind !== "vertex") return;
    setSelection(selected);
    dispatch({ type: "newPath", id: selected.pathId });
    drag.current = {
      document,
      pathId: selected.pathId,
      index: selected.index,
      point: document.paths.find((p) => p.id === selected.pathId)!.points[
        selected.index
      ]!,
    };
  }
  function dragMove(raw: PointMm) {
    const current = drag.current;
    if (!current) return;
    const path = current.document.paths.find((p) => p.id === current.pathId);
    const result = snap(raw, path, current.index);
    current.point = result.point;
    setHint(result);
    setPreview({
      ...current.document,
      paths: current.document.paths.map((p) =>
        p.id === current.pathId
          ? {
              ...p,
              points: p.points.map((point, i) =>
                i === current.index ? result.point : point,
              ),
            }
          : p,
      ),
    });
  }
  function dragEnd(cancel = false) {
    const current = drag.current;
    drag.current = null;
    setPreview(null);
    setHint(null);
    if (!current || cancel) return;
    perform(() =>
      apply(
        movePoint(
          current.document,
          current.pathId,
          current.index,
          current.point,
        ),
      ),
    );
  }
  function fit() {
    const points = document.paths
      .flatMap((p) => p.points)
      .concat(document.dimensions.flatMap((m) => [m.from, m.to]));
    setViewport(fitViewport(points, size.width, size.height));
  }
  function zoom(factor: number) {
    setViewport((v) =>
      zoomAt(v, { x: size.width / 2, y: size.height / 2 }, factor),
    );
  }
  async function save() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    const snapshot = document;
    try {
      await repo.saveDrawing(projectId, snapshot);
      setBaseline(JSON.stringify(snapshot));
      setSaved(true);
    } catch (e) {
      setError(`Çizim kaydedilemedi: ${errorMessage(e)}`);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return {
    project,
    document,
    displayDocument: preview ?? document,
    activePath,
    selectedPath,
    report,
    history,
    selection,
    setSelection,
    viewport,
    setViewport,
    tool,
    changeTool,
    measureStart,
    hint,
    loading,
    loadError,
    error,
    saving,
    saved,
    dirty,
    panel,
    setPanel,
    size,
    setSize,
    point,
    newRegion,
    close,
    resize,
    move,
    merge,
    remove,
    properties,
    updateSettings,
    historyStep,
    dragStart,
    dragMove,
    dragEnd,
    fit,
    zoom,
    save,
    retry: () => setAttempt((n) => n + 1),
  };
}
export type DrawingWorkspace = ReturnType<typeof useDrawingWorkspace>;

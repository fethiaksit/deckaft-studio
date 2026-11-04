import { draftToSettings, type FramingSettingsDraft } from "../form";
import { useCallback, useRef, useState, useMemo } from "react";
import { Alert } from "react-native";
import { useFocusEffect, usePreventRemove } from "expo-router";
import { useRepository } from "../../../core/db/provider";
import { newId } from "../../../core/db/repository";
import { errorMessage } from "../../../core/store/projects";
import type { Project } from "../../projects/model";
import { emptyDrawing } from "../../drawing/model";
import { createHistory, commit, undo, redo } from "../../drawing/history";
import { DEFAULT_VIEWPORT, zoomAt } from "../../drawing/coordinates";
import { fitViewport, segmentDistance } from "../../geometry/interaction";
import type { PointMm } from "../../geometry/model";
import { defaultFramingSettings } from "../config";
import {
  generateFraming,
  framingTotals,
  sourceGeometrySignature,
} from "../engine";
import {
  addMember,
  updateMember,
  translateMember,
  removeMember,
  updateSupport,
  removeSupport,
} from "../operations";
import type { FramingPlan, FramingLayer, FramingSettings } from "../model";
export type FramingTool = "select" | "pan" | "add" | "move";
export function useFramingWorkspace(projectId: string) {
  const repo = useRepository();
  const [project, setProject] = useState<Project | null>(null);
  const [drawing, setDrawing] = useState(emptyDrawing);
  const [history, setHistory] = useState(() =>
    createHistory<FramingPlan | null>(null),
  );
  const plan = history.present;
  const [settings, setSettings] = useState(defaultFramingSettings);
  const [settingsDraft, setSettingsDraft] =
    useState<FramingSettingsDraft | null>(null);
  const [baselineSettings, setBaselineSettings] = useState(
    JSON.stringify(defaultFramingSettings()),
  );
  const [baseline, setBaseline] = useState("null");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [retryCount, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [panel, setPanel] = useState<"plan" | "settings" | "profile" | null>(
    null,
  );
  const [tool, setTool] = useState<FramingTool>("select");
  const [newLayer, setNewLayer] = useState<FramingLayer>("upper");
  const [anchor, setAnchor] = useState<PointMm | null>(null);
  const [visibility, setVisibility] = useState<Record<FramingLayer, boolean>>({
    upper: true,
    lower: true,
    perimeter: true,
  });
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const busy = useRef(false);
  const mounted = useRef(true);
  const [preview, setPreview] = useState<{
    id: string;
    dx: number;
    dy: number;
  } | null>(null);
  const drag = useRef<{
    plan: FramingPlan;
    id: string;
    start: PointMm;
    delta: { dx: number; dy: number };
  } | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      mounted.current = true;
      setLoading(true);
      setLoadError("");
      void Promise.all([
        repo.get(projectId),
        repo.getDrawing(projectId),
        repo.getFraming(projectId),
      ])
        .then(([p, d, f]) => {
          if (!active) return;
          if (!p) throw new Error("Proje bulunamadı.");
          setProject(p);
          setDrawing(d);
          setHistory(createHistory(f));
          setBaseline(JSON.stringify(f));
          const s = f?.settings ?? defaultFramingSettings();
          setSettings(s);
          setSettingsDraft(null);
          setBaselineSettings(JSON.stringify(s));
          setSelection(null);
          setAnchor(null);
          setError("");
          setSaved(false);
          setViewport(
            fitViewport(
              d.paths.flatMap((p) => p.points),
              size.width || 393,
              size.height || 500,
            ),
          );
        })
        .catch((e) => {
          if (active) setLoadError(errorMessage(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
        mounted.current = false;
      };
    }, [projectId, repo, retryCount]),
  );
  const settingsDirty =
    !!settingsDraft ||
    (!!plan && JSON.stringify(settings) !== JSON.stringify(plan.settings));
  const dirty =
    !!settingsDraft ||
    JSON.stringify(plan) !== baseline ||
    JSON.stringify(settings) !== baselineSettings;
  const stale =
    !!plan && plan.sourceGeometry !== sourceGeometrySignature(drawing);
  usePreventRemove(dirty || saving, ({ repeat }) => {
    if (busy.current) {
      Alert.alert("İşlem sürüyor", "Lütfen işlemin bitmesini bekleyin.");
      return;
    }
    Alert.alert(
      "Karkas kaydedilmedi",
      "Değişiklikleri bırakıp çıkmak istiyor musunuz?",
      [
        { text: "Düzenlemeye dön", style: "cancel" },
        {
          text: "Kaydetmeden çık",
          style: "destructive",
          onPress: () => {
            setBaseline(JSON.stringify(plan));
            setBaselineSettings(JSON.stringify(settings));
            setSettingsDraft(null);
            repeat();
          },
        },
      ],
    );
  });
  const totals = useMemo(() => (plan ? framingTotals(plan) : null), [plan]);
  const selected = plan?.members.find((m) => m.id === selection) ?? null;
  function perform(action: () => void) {
    if (busy.current) return;
    try {
      action();
      setError("");
      setSaved(false);
    } catch (e) {
      setError(errorMessage(e));
      setPreview(null);
    }
  }
  function apply(next: FramingPlan) {
    setHistory((h) => commit(h, next));
  }
  function generateWith(nextSettings: FramingSettings) {
    perform(() => {
      const now = new Date().toISOString();
      const next = generateFraming(drawing, nextSettings, {
        id: plan?.id ?? newId(),
        projectId,
        now,
      });
      apply({ ...next, createdAt: plan?.createdAt ?? next.createdAt });
      setSettings(nextSettings);
      setSettingsDraft(null);
      setSelection(null);
      setAnchor(null);
    });
  }
  function generate() {
    generateWith(
      settingsDraft ? draftToSettings(settings, settingsDraft) : settings,
    );
  }
  function select(id: string | null) {
    setSelection(id);
    if (id) setPanel("profile");
  }
  function find(point: PointMm) {
    let best = 24 / viewport.scale;
    let id: string | null = null;
    for (const m of plan?.members ?? []) {
      if (!visibility[m.layer]) continue;
      const distance = segmentDistance(point, m.start, m.end);
      if (distance <= best) {
        best = distance;
        id = m.id;
      }
    }
    return id;
  }
  function pick(point: PointMm) {
    if (tool === "add") {
      perform(() => {
        if (!plan) throw new Error("Önce karkas oluşturun.");
        if (!anchor) {
          setAnchor(point);
          return;
        }
        const next = addMember(
          plan,
          drawing,
          { start: anchor, end: point, layer: newLayer },
          new Date().toISOString(),
        );
        apply(next);
        setAnchor(null);
        select(next.members.at(-1)?.id ?? null);
      });
    } else if (tool !== "pan") select(find(point));
  }
  function changeTool(t: FramingTool) {
    setTool(t);
    setAnchor(null);
    setPreview(null);
    drag.current = null;
  }
  function edit(input: Parameters<typeof updateMember>[3]) {
    perform(() => {
      if (!plan || !selection) throw new Error("Bir profil seçin.");
      apply(
        updateMember(plan, drawing, selection, input, new Date().toISOString()),
      );
    });
  }
  function add(input: Parameters<typeof addMember>[2]) {
    perform(() => {
      if (!plan) throw new Error("Önce karkas oluşturun.");
      const next = addMember(plan, drawing, input, new Date().toISOString());
      apply(next);
      select(next.members.at(-1)?.id ?? null);
    });
  }
  function moveTo(start: PointMm) {
    perform(() => {
      if (!plan || !selected) throw new Error("Bir profil seçin.");
      apply(
        translateMember(
          plan,
          drawing,
          selected.id,
          start.x - selected.start.x,
          start.y - selected.start.y,
          new Date().toISOString(),
        ),
      );
    });
  }
  function deleteSelected() {
    perform(() => {
      if (!plan || !selection) throw new Error("Bir profil seçin.");
      apply(removeMember(plan, drawing, selection, new Date().toISOString()));
      setSelection(null);
    });
  }
  function support(input: Parameters<typeof updateSupport>[2]) {
    perform(() => {
      if (!plan) throw new Error("Önce karkas oluşturun.");
      apply(updateSupport(plan, drawing, input, new Date().toISOString()));
    });
  }
  function deleteSupport(id: string) {
    perform(() => {
      if (!plan) return;
      apply(removeSupport(plan, drawing, id, new Date().toISOString()));
    });
  }
  function historyStep(type: "undo" | "redo") {
    if (busy.current) return;
    const h = type === "undo" ? undo(history) : redo(history);
    setHistory(h);
    if (h.present) setSettings(h.present.settings);
    setSelection(null);
    setError("");
    setSaved(false);
    setPreview(null);
  }
  function resetAuto() {
    Alert.alert(
      "Otomatik plana dön",
      "Manuel profil ve mesnet değişiklikleri yeniden oluşturulan planla değişecek. Geri al ile önceki plana dönebilirsiniz.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Yeniden oluştur", onPress: generate },
      ],
    );
  }
  function fit() {
    setViewport(
      fitViewport(
        [
          ...drawing.paths.flatMap((p) => p.points),
          ...(plan?.members.flatMap((m) => [m.start, m.end]) ?? []),
        ],
        size.width,
        size.height,
      ),
    );
  }
  function zoom(factor: number) {
    setViewport((v) =>
      zoomAt(v, { x: size.width / 2, y: size.height / 2 }, factor),
    );
  }
  function dragStart(point: PointMm) {
    if (!plan || stale || busy.current) return;
    const id = find(point);
    if (!id) return;
    select(id);
    drag.current = { plan, id, start: point, delta: { dx: 0, dy: 0 } };
  }
  function dragMove(point: PointMm) {
    if (drag.current) {
      const delta = {
        dx: point.x - drag.current.start.x,
        dy: point.y - drag.current.start.y,
      };
      drag.current.delta = delta;
      setPreview({ id: drag.current.id, ...delta });
    }
  }
  function dragEnd(cancel = false) {
    const current = drag.current;
    drag.current = null;
    const delta = current?.delta;
    setPreview(null);
    if (!current || !delta || cancel) return;
    perform(() =>
      apply(
        translateMember(
          current.plan,
          drawing,
          current.id,
          delta.dx,
          delta.dy,
          new Date().toISOString(),
        ),
      ),
    );
  }
  async function save() {
    if (busy.current) return;
    if (!plan) {
      setError("Önce karkas oluşturun.");
      return;
    }
    if (stale) {
      setError("Alan değişti; karkası yeniden oluşturun.");
      return;
    }
    if (settingsDirty) {
      setError("Ayarlar değişti; önce Karkas Oluştur ile uygulayın.");
      return;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await repo.saveFraming(plan);
      if (mounted.current) {
        setBaseline(JSON.stringify(plan));
        setBaselineSettings(JSON.stringify(settings));
        setSaved(true);
      }
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return {
    project,
    drawing,
    plan,
    history,
    settings,
    setSettings,
    settingsDraft,
    setSettingsDraft,
    settingsDirty,
    loading,
    loadError,
    error,
    saving,
    saved,
    dirty,
    stale,
    totals,
    selected,
    selection,
    select,
    panel,
    setPanel,
    tool,
    changeTool,
    newLayer,
    setNewLayer,
    anchor,
    visibility,
    setVisibility,
    viewport,
    setViewport,
    size,
    setSize,
    preview,
    generate,
    generateWith,
    resetAuto,
    pick,
    edit,
    add,
    moveTo,
    deleteSelected,
    support,
    deleteSupport,
    historyStep,
    fit,
    zoom,
    dragStart,
    dragMove,
    dragEnd,
    save,
    retry: () => setRetry((n) => n + 1),
  };
}
export type FramingWorkspace = ReturnType<typeof useFramingWorkspace>;

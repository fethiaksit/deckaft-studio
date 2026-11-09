import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect, usePreventRemove } from "expo-router";
import { useRepository } from "../../../core/db/provider";
import { newId } from "../../../core/db/repository";
import { errorMessage } from "../../../core/store/projects";
import type { FramingPlan } from "../../framing/model";
import { createCuttingPlan } from "../persistence";
import { framingRevision, type CuttingPlan } from "../model";
const initial = {
  stockLengthMm: "6000",
  cutKerfMm: "3",
  startTrimMm: "0",
  endTrimMm: "0",
  minReusableMm: "500",
};
export type CuttingDraft = typeof initial;
const toDraft = (s: CuttingPlan["settings"]): CuttingDraft => ({
  stockLengthMm: String(s.stockLengthMm),
  cutKerfMm: String(s.cutKerfMm),
  startTrimMm: String(s.startTrimMm),
  endTrimMm: String(s.endTrimMm),
  minReusableMm: String(s.minReusableMm),
});
export function useCuttingWorkspace(projectId: string) {
  const repo = useRepository();
  const [source, setSource] = useState<FramingPlan | null>(null),
    [plan, setPlan] = useState<CuttingPlan | null>(null);
  const [draft, setDraft] = useState(initial),
    [applied, setApplied] = useState(JSON.stringify(initial));
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [baseline, setBaseline] = useState("null"),
    [retryCount, setRetry] = useState(0);
  const active = useRef(false),
    locked = useRef(false),
    epoch = useRef(0);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      const generation = ++epoch.current;
      setLoading(true);
      setLoadError("");
      setError("");
      void Promise.all([repo.getFraming(projectId), repo.getCutting(projectId)])
        .then(([s, p]) => {
          if (!active.current || generation !== epoch.current) return;
          setSource(s);
          setPlan(p);
          setBaseline(JSON.stringify(p));
          const d = p
            ? toDraft(p.settings)
            : {
                ...initial,
                stockLengthMm: String(s?.settings.stockLengthMm ?? 6000),
                cutKerfMm: String(s?.settings.kerfMm ?? 3),
              };
          setDraft(d);
          setApplied(JSON.stringify(d));
        })
        .catch((e) => {
          if (active.current && generation === epoch.current)
            setLoadError(errorMessage(e));
        })
        .finally(() => {
          if (active.current && generation === epoch.current) setLoading(false);
        });
      return () => {
        active.current = false;
        epoch.current++;
      };
    }, [repo, projectId, retryCount]),
  );
  const settingsDirty = JSON.stringify(draft) !== applied;
  const dirty = JSON.stringify(plan) !== baseline || settingsDirty;
  usePreventRemove(dirty || busy, ({ repeat }) => {
    if (locked.current) {
      Alert.alert(
        "İşlem sürüyor",
        "Lütfen hesaplamanın/kaydın bitmesini bekleyin.",
      );
      return;
    }
    Alert.alert(
      "Kesim planı kaydedilmedi",
      "Değişiklikleri bırakıp çıkmak istiyor musunuz?",
      [
        { text: "Düzenlemeye dön", style: "cancel" },
        {
          text: "Kaydetmeden çık",
          style: "destructive",
          onPress: () => {
            setBaseline(JSON.stringify(plan));
            setApplied(JSON.stringify(draft));
            repeat();
          },
        },
      ],
    );
  });
  function setField(key: keyof CuttingDraft, value: string) {
    if (locked.current) return;
    setDraft((d) => ({ ...d, [key]: value }));
    setError("");
  }
  async function generate() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const generation = epoch.current;
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const s = await repo.getFraming(projectId);
      if (!s) throw Error("Önce karkas planını oluşturup kaydedin.");
      if (s.warnings.some((w) => w.code === "STALE_SOURCE"))
        throw Error("Alan değişti; önce karkası yeniden oluşturup kaydedin.");
      const values = Object.fromEntries(
        Object.entries(draft).map(([k, v]) => {
          if (!/^\d+(?:[.,]\d+)?$/.test(v.trim()))
            throw Error(
              "Geçersiz kesim ayarı. Pozitif veya sıfır mm değeri girin.",
            );
          return [k, Number(v.replace(",", "."))];
        }),
      );
      const result = createCuttingPlan(s, values, {
        id: newId(),
        now: new Date().toISOString(),
      });
      if (active.current && generation === epoch.current) {
        setSource(s);
        setPlan(result);
        setDraft(toDraft(result.settings));
        setApplied(JSON.stringify(toDraft(result.settings)));
      }
    } catch (e) {
      if (active.current && generation === epoch.current)
        setError(errorMessage(e));
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function save() {
    if (locked.current) return false;
    if (!plan || settingsDirty || plan.stale) {
      setError("Ayarlar veya kaynak değişti; kesim planını yeniden oluşturun.");
      return false;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    const generation = epoch.current;
    try {
      const s = await repo.getFraming(projectId);
      if (!s || framingRevision(s) !== plan.sourceRevision) {
        if (active.current) setPlan((p) => (p ? { ...p, stale: true } : p));
        throw Error("Karkas değişti; kesim planını yeniden oluşturun.");
      }
      await repo.saveCutting(plan);
      if (active.current && generation === epoch.current)
        setBaseline(JSON.stringify(plan));
      return true;
    } catch (e) {
      if (active.current && generation === epoch.current) {
        setError(errorMessage(e));
        // A conditional SQL write may detect a source race after the first read.
        const s = await repo.getFraming(projectId).catch(() => null);
        if (!s || framingRevision(s) !== plan.sourceRevision)
          setPlan((p) => (p ? { ...p, stale: true } : p));
      }
      return false;
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  return {
    source,
    plan,
    draft,
    setField,
    settingsDirty,
    dirty,
    loading,
    loadError,
    error,
    busy,
    generate,
    save,
    retry: () => setRetry((n) => n + 1),
  };
}

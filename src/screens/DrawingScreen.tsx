import { useEffect, useRef, useState, useReducer } from "react";
import {
  View,
  ScrollView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, usePreventRemove } from "expo-router";
import {
  ArrowLeft,
  Save,
  SlidersHorizontal,
  X,
  CornerDownRight,
} from "lucide-react-native";
import {
  Button,
  IconButton,
  Label,
  Field,
  Page,
  StateView,
} from "../components/ui";
import { useRepository } from "../core/db/provider";
import { newId } from "../core/db/repository";
import { errorMessage } from "../core/store/projects";
import { useTheme, useResponsive } from "../core/theme/theme";
import type { Project } from "../modules/projects/model";
import type { PointMm } from "../modules/geometry/model";
import {
  emptyDrawing,
  appendPoint,
  addDimension,
  type DrawingDocument,
  type DrawingTool,
} from "../modules/drawing/model";
import { DEFAULT_VIEWPORT, zoomAt } from "../modules/drawing/coordinates";
import { createEditor, editorReducer } from "../modules/drawing/editor";
import { DrawingCanvas } from "../modules/drawing/components/DrawingCanvas";
import { DrawingToolbar } from "../modules/drawing/components/DrawingToolbar";

function segmentDistance(p: PointMm, a: PointMm, b: PointMm) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const d = dx * dx + dy * dy;
  const t = d
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / d))
    : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export default function DrawingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const repo = useRepository();
  const { colors } = useTheme();
  const { tablet, width, height } = useResponsive();
  const [project, setProject] = useState<Project | null>(null);
  const [{ history, pathId }, dispatch] = useReducer(
    editorReducer,
    undefined,
    () => createEditor(emptyDrawing(), newId()),
  );
  const [baseline, setBaseline] = useState(JSON.stringify(emptyDrawing()));
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  const [tool, setToolState] = useState<DrawingTool>("draw");
  const [grid, setGrid] = useState(true);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [measureStart, setMeasureStart] = useState<PointMm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [panel, setPanel] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const savingRef = useRef(false);
  const document = history.present;
  const dirty = JSON.stringify(document) !== baseline;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    void Promise.all([repo.get(id), repo.getDrawing(id)])
      .then(([p, d]) => {
        if (!active) return;
        if (!p) throw new Error("Proje bulunamadı.");
        setProject(p);
        dispatch({ type: "load", document: d, pathId: newId() });
        setBaseline(JSON.stringify(d));
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
  }, [id, repo, attempt]);
  usePreventRemove(dirty || saving, ({ repeat }) => {
    if (savingRef.current) {
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
  function edit(next: DrawingDocument) {
    dispatch({ type: "document", document: next });
    setSaved(false);
    setError("");
  }
  function changeTool(t: DrawingTool) {
    setToolState(t);
    setMeasureStart(null);
    setSelected(null);
  }
  function handlePoint(p: PointMm) {
    if (savingRef.current) return;
    const point = { x: Math.round(p.x), y: Math.round(p.y) };
    try {
      if (tool === "draw") edit(appendPoint(document, pathId, point));
      else if (tool === "measure") {
        if (!measureStart) setMeasureStart(point);
        else {
          edit(addDimension(document, newId(), measureStart, point));
          setMeasureStart(null);
        }
      } else if (tool === "select") {
        let best = 24 / viewport.scale;
        let found: string | null = null;
        const check = (id: string, a: PointMm, b: PointMm) => {
          const d = segmentDistance(point, a, b);
          if (d < best) {
            best = d;
            found = id;
          }
        };
        document.paths.forEach((path) =>
          path.points.forEach((p, i) =>
            check(path.id, path.points[Math.max(0, i - 1)]!, p),
          ),
        );
        document.dimensions.forEach((d) => check(d.id, d.from, d.to));
        setSelected(found);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    const snapshot = document;
    try {
      await repo.saveDrawing(id, snapshot);
      setBaseline(JSON.stringify(snapshot));
      setSaved(true);
    } catch (e) {
      setError(`Çizim kaydedilemedi: ${errorMessage(e)}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  const leave = () =>
    router.canGoBack() ? router.back() : router.replace("/draw");
  const instructions = {
    draw: "Köşe eklemek için dokunun. Yeni çizgi ile ayrı bir çizime başlayın.",
    measure: measureStart
      ? "Ölçünün bitiş noktasına dokunun."
      : "Ölçünün başlangıç ve bitiş noktalarına dokunun.",
    select:
      "Bir çizgiye veya ölçüye dokunarak seçin. Alan hesabı bu fazda yok.",
    pan: "Tek parmakla kaydırın. İki parmakla yakınlaştırın.",
  }[tool];
  const controls = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 18, gap: 16 }}
    >
      <View>
        <Label
          style={{ color: colors.accent, fontSize: 11, letterSpacing: 1.2 }}
        >
          PROJE / ÇİZİM
        </Label>
        <Label style={{ fontSize: 19, fontWeight: "600", marginTop: 9 }}>
          {project?.name}
        </Label>
        <Label muted>
          {project?.type} · {project?.city} / {project?.district}
        </Label>
        {project?.customer ? (
          <Label muted>Müşteri: {project.customer}</Label>
        ) : null}
        {project?.description ? (
          <Label muted>{project.description}</Label>
        ) : null}
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <Label style={{ fontWeight: "600" }}>Hassas nokta girişi</Label>
      <Label muted style={{ fontSize: 12 }}>
        Koordinatlar milimetre cinsindedir. Ondalık girişler en yakın mm'ye
        yuvarlanır.
      </Label>
      <Field
        label="X (mm)"
        placeholder="Örn. 3000"
        value={x}
        onChangeText={setX}
        keyboardType={
          Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"
        }
      />
      <Field
        label="Y (mm)"
        placeholder="Örn. 2000"
        value={y}
        onChangeText={setY}
        keyboardType={
          Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"
        }
      />
      <Button
        title={tool === "measure" ? "Ölçü noktası ekle" : "Çizgi noktası ekle"}
        disabled={saving || (tool !== "draw" && tool !== "measure")}
        onPress={() => {
          const px = Number(x.replace(",", "."));
          const py = Number(y.replace(",", "."));
          if (
            !x.trim() ||
            !y.trim() ||
            !Number.isFinite(px) ||
            !Number.isFinite(py)
          ) {
            setError("Geçerli X ve Y koordinatları girin.");
            return;
          }
          handlePoint({ x: px, y: py });
        }}
      />
      <Button
        title="Yeni çizgi"
        icon={CornerDownRight}
        variant="secondary"
        disabled={saving}
        onPress={() => {
          dispatch({ type: "newPath", id: newId() });
          changeTool("draw");
        }}
      />
      <Label muted style={{ fontSize: 12 }}>
        {document.paths.length} çizgi · {document.dimensions.length} ölçü
      </Label>
      <Label muted style={{ fontSize: 12 }}>
        Çizim: mm · Görünüm: piksel İki parmak: yakınlaştır / kaydır Kalem: köşe
        noktalarına dokunun
      </Label>
      <Label muted style={{ fontSize: 12 }}>
        Alan ve karkas hesaplamaları sonraki fazlarda eklenecek.
      </Label>
    </ScrollView>
  );
  if (loading || loadError)
    return (
      <Page title="Çizim çalışma alanı" back>
        <StateView
          title={loading ? "Çizim açılıyor" : "Çizim açılamadı"}
          loading={loading}
          description={loadError || undefined}
          action={
            loadError ? (
              <Button
                title="Tekrar dene"
                onPress={() => setAttempt((a) => a + 1)}
              />
            ) : undefined
          }
        />
      </Page>
    );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "bottom", "left", "right"]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          padding: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <IconButton
          icon={ArrowLeft}
          label="Çizimden çık"
          disabled={saving}
          onPress={leave}
        />
        <View style={{ flex: 1 }}>
          <Label style={{ fontWeight: "600" }}>{project?.name}</Label>
          <Label muted style={{ fontSize: 10 }}>
            {saving
              ? "Kaydediliyor…"
              : dirty
                ? "Kaydedilmemiş değişiklikler"
                : saved
                  ? "Çizim kaydedildi"
                  : "Yerel çizim · mm"}
          </Label>
        </View>
        {!tablet && (
          <IconButton
            icon={SlidersHorizontal}
            label="Proje ve nokta girişi"
            onPress={() => setPanel(true)}
          />
        )}
        <Button
          title="Kaydet"
          icon={Save}
          loading={saving}
          onPress={() => void save()}
        />
      </View>
      {error ? (
        <Label
          style={{ color: colors.danger, padding: 10 }}
          accessibilityRole="alert"
        >
          {error}
        </Label>
      ) : null}
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={{ flex: 1 }}>
          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              backgroundColor: colors.surface,
            }}
          >
            <Label muted style={{ fontSize: 11 }}>
              {instructions}
            </Label>
          </View>
          <View pointerEvents={saving ? "none" : "auto"} style={{ flex: 1 }}>
            <DrawingCanvas
              document={document}
              viewport={viewport}
              onViewport={setViewport}
              tool={tool}
              onPoint={handlePoint}
              selectedId={selectedId}
              measureStart={measureStart}
              grid={grid}
            />
          </View>
          <View pointerEvents={saving ? "none" : "auto"}>
            <DrawingToolbar
              tool={tool}
              setTool={changeTool}
              canUndo={!!history.past.length}
              canRedo={!!history.future.length}
              onUndo={() => {
                dispatch({ type: "undo" });
                setMeasureStart(null);
                setSelected(null);
                setSaved(false);
              }}
              onRedo={() => {
                dispatch({ type: "redo" });
                setMeasureStart(null);
                setSelected(null);
                setSaved(false);
              }}
              grid={grid}
              toggleGrid={() => setGrid((g) => !g)}
              selected={!!selectedId}
              onDelete={() => {
                edit({
                  ...document,
                  paths: document.paths.filter((p) => p.id !== selectedId),
                  dimensions: document.dimensions.filter(
                    (d) => d.id !== selectedId,
                  ),
                });
                setSelected(null);
              }}
              onZoom={(factor) =>
                setViewport((v) =>
                  zoomAt(
                    v,
                    { x: (width - (tablet ? 300 : 0)) / 2, y: height / 3 },
                    factor,
                  ),
                )
              }
              onReset={() => setViewport(DEFAULT_VIEWPORT)}
            />
          </View>
        </View>
        {tablet && (
          <View
            style={{
              width: 300,
              borderLeftWidth: 1,
              borderLeftColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            {controls}
          </View>
        )}
      </View>
      <Modal
        visible={panel && !tablet}
        animationType="slide"
        onRequestClose={() => setPanel(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 14,
              }}
            >
              <Label style={{ fontSize: 18, fontWeight: "600" }}>
                Çizim ayarları
              </Label>
              <IconButton
                icon={X}
                label="Paneli kapat"
                onPress={() => setPanel(false)}
              />
            </View>
            {error ? (
              <Label style={{ color: colors.danger, paddingHorizontal: 18 }}>
                {error}
              </Label>
            ) : null}
            {controls}
            <View style={{ padding: 16 }}>
              <Button title="Çizime dön" onPress={() => setPanel(false)} />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

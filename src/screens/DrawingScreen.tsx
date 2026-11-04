import { View, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Save,
  SlidersHorizontal,
  X,
  Layers,
} from "lucide-react-native";
import { Button, IconButton, Label, Page, StateView } from "../components/ui";
import { useTheme, useResponsive } from "../core/theme/theme";
import { DrawingCanvas } from "../modules/drawing/components/DrawingCanvas";
import { DrawingToolbar } from "../modules/drawing/components/DrawingToolbar";
import { DrawingProperties } from "../modules/drawing/components/DrawingProperties";
import { AreaSummary } from "../modules/drawing/components/AreaSummary";
import { useDrawingWorkspace } from "../modules/drawing/hooks/useDrawingWorkspace";
export default function DrawingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const w = useDrawingWorkspace(id);
  const { colors } = useTheme();
  const { tablet, height } = useResponsive();
  if (w.loading || w.loadError)
    return (
      <Page title="Çizim çalışma alanı" back>
        <StateView
          title={w.loading ? "Çizim açılıyor" : "Çizim açılamadı"}
          loading={w.loading}
          description={w.loadError || undefined}
          action={
            w.loadError ? (
              <Button title="Tekrar dene" onPress={w.retry} />
            ) : undefined
          }
        />
      </Page>
    );
  const instruction = {
    draw: "Köşelere dokunun. İlk noktaya dönerek alanı kapatın.",
    measure: w.measureStart
      ? "Ölçünün bitiş noktasına dokunun."
      : "Ölçünün iki noktasına dokunun.",
    select: "Kenar veya köşe seçin; ölçüler panelinde düzenleyin.",
    move: "Bir köşeyi sürükleyin veya dokunup koordinat girin.",
    pan: "Tek parmakla kaydırın; iki parmakla yakınlaştırın.",
  }[w.tool];
  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            padding: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <IconButton
            icon={ArrowLeft}
            label="Çizimden çık"
            disabled={w.saving}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/draw")
            }
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label numberOfLines={1} style={{ fontWeight: "600" }}>
              {w.project?.name}
            </Label>
            <Label muted style={{ fontSize: 10 }}>
              {w.saving
                ? "Kaydediliyor…"
                : w.dirty
                  ? "Kaydedilmemiş değişiklikler"
                  : w.saved
                    ? "Çizim kaydedildi"
                    : "Akıllı çizim · mm"}
            </Label>
          </View>
          {!tablet && (
            <IconButton
              icon={SlidersHorizontal}
              label="Ölçüler ve özellikler"
              active={w.panel}
              onPress={() => w.setPanel((v) => !v)}
            />
          )}
          <IconButton
            icon={Layers}
            label="Karkas planını aç"
            disabled={w.saving}
            onPress={() => {
              if (w.dirty)
                Alert.alert(
                  "Önce çizimi kaydedin",
                  "Karkas kayıtlı alan geometrisinden oluşturulur.",
                );
              else router.push({ pathname: "/framing/[id]", params: { id } });
            }}
          />
          <Button
            title="Kaydet"
            icon={Save}
            loading={w.saving}
            onPress={() => void w.save()}
          />
        </View>
        {!tablet && <AreaSummary report={w.report} compact />}
        <View style={{ flex: 1, flexDirection: "row" }}>
          {tablet && <DrawingToolbar workspace={w} vertical />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: colors.surface,
              }}
            >
              <Label muted style={{ fontSize: 10, lineHeight: 15 }}>
                {instruction}
                {w.hint?.kind
                  ? ` · ${{ vertex: "Köşeye yakalandı", grid: "Izgaraya hizalı", horizontal: "Yatay hizalı", vertical: "Dikey hizalı" }[w.hint.kind]}`
                  : ""}
              </Label>
            </View>
            {w.error && (!w.panel || tablet) ? (
              <Label
                accessibilityRole="alert"
                style={{ padding: 8, fontSize: 11, color: colors.danger }}
              >
                {w.error}
              </Label>
            ) : null}
            <View
              style={{ flex: 1 }}
              pointerEvents={w.saving ? "none" : "auto"}
            >
              <DrawingCanvas workspace={w} />
            </View>
            {!tablet && w.panel && (
              <View
                style={{
                  height: Math.min(360, height * 0.43),
                  flexShrink: 1,
                  backgroundColor: colors.surface,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingLeft: 14,
                    paddingRight: 4,
                  }}
                >
                  <Label style={{ flex: 1, fontWeight: "600" }}>
                    Ölçüler ve özellikler
                  </Label>
                  <IconButton
                    icon={X}
                    label="Ölçü panelini gizle"
                    onPress={() => w.setPanel(false)}
                  />
                </View>
                <DrawingProperties workspace={w} />
              </View>
            )}
            {!tablet && <DrawingToolbar workspace={w} />}
          </View>
          {tablet && (
            <View
              style={{
                width: 280,
                borderLeftWidth: 1,
                borderLeftColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <DrawingProperties workspace={w} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

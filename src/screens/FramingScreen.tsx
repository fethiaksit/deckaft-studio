import { View, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import {
  ArrowLeft,
  Save,
  Settings2,
  X,
  ChartNoAxesCombined,
} from "lucide-react-native";
import { Page, StateView, Button, IconButton, Label } from "../components/ui";
import { useTheme, useResponsive } from "../core/theme/theme";
import { useFramingWorkspace } from "../modules/framing/hooks/useFramingWorkspace";
import { FramingCanvas } from "../modules/framing/components/FramingCanvas";
import { FramingToolbar } from "../modules/framing/components/FramingToolbar";
import {
  FramingProperties,
  LayerControls,
} from "../modules/framing/components/FramingProperties";
import { FRAMING } from "../modules/framing/config";
export default function FramingScreen() {
  const { id, memberId } = useLocalSearchParams<{
    id: string;
    memberId?: string;
  }>();
  const w = useFramingWorkspace(id, memberId);
  const { colors } = useTheme();
  const { tablet, height } = useResponsive();
  if (w.loading || w.loadError)
    return (
      <Page title="Karkas çalışma alanı" back>
        <StateView
          title={w.loading ? "Karkas açılıyor" : "Karkas açılamadı"}
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
  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 9,
            gap: 7,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <IconButton
            icon={ArrowLeft}
            label="Karkastan çık"
            disabled={w.saving}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/projects")
            }
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label numberOfLines={1} style={{ fontWeight: "600" }}>
              {w.project?.name}
            </Label>
            <Label muted style={{ fontSize: 10 }}>
              {w.saving
                ? "Kaydediliyor…"
                : w.saved && !w.dirty
                  ? "Karkas kaydedildi"
                  : w.dirty
                    ? "Kaydedilmemiş karkas"
                    : "Karkas ön yerleşimi"}
            </Label>
          </View>
          {!tablet && (
            <IconButton
              icon={Settings2}
              label="Karkas ayar paneli"
              onPress={() => w.setPanel("settings")}
            />
          )}
          <Button
            title="Kaydet"
            icon={Save}
            loading={w.saving}
            onPress={() => void w.save()}
          />
        </View>
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 7,
            backgroundColor: colors.surface,
          }}
        >
          <Label style={{ fontSize: 11, color: colors.accent }}>
            {FRAMING.statusLabel}
          </Label>
          {w.stale && (
            <Label
              accessibilityRole="alert"
              style={{ fontSize: 11, color: colors.danger }}
            >
              Alan değişti. Bu eski plan güncel değildir; yeniden oluşturun.
            </Label>
          )}
          {w.settingsDirty && (
            <Label muted style={{ fontSize: 10 }}>
              Ayarlar değişti; yeniden oluşturun.
            </Label>
          )}
        </View>
        {w.plan && (
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, gap: 5 }}>
            <Button
              title={
                w.selected
                  ? `${w.selected.code} · Kesim parçasını aç`
                  : "Profil kesim planını aç"
              }
              variant="secondary"
              disabled={w.dirty || w.stale || w.saving || w.settingsDirty}
              onPress={() =>
                router.push({
                  pathname: "/cutting/[id]",
                  params: {
                    id,
                    ...(w.selected ? { memberId: w.selected.id } : {}),
                  },
                })
              }
            />
            {w.dirty && (
              <Label muted style={{ fontSize: 11 }}>
                Kesime geçmeden önce karkas değişikliklerini kaydedin.
              </Label>
            )}
          </View>
        )}
        {w.error && (
          <Label
            accessibilityRole="alert"
            style={{ color: colors.danger, padding: 8, fontSize: 11 }}
          >
            {w.error}
          </Label>
        )}
        {!tablet && (
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 10,
              alignItems: "center",
              gap: 8,
            }}
          >
            <LayerControls workspace={w} />
            <View style={{ flex: 1 }}>
              <Label muted style={{ fontSize: 10 }}>
                {w.totals
                  ? `${(w.totals.totalLengthMm / 1000).toFixed(2)} m · ${w.plan?.members.length} profil`
                  : "Henüz plan yok"}
              </Label>
            </View>
            {!w.plan && <Button title="Karkas Oluştur" onPress={w.generate} />}
          </View>
        )}
        <View style={{ flex: 1, flexDirection: "row" }}>
          {tablet && <FramingToolbar workspace={w} vertical />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{ flex: 1, minHeight: 60 }}
              pointerEvents={w.saving ? "none" : "auto"}
            >
              <FramingCanvas workspace={w} />
            </View>
            {!tablet && w.panel && (
              <View
                style={{
                  height: Math.min(380, height * 0.46),
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
                  }}
                >
                  <Label style={{ flex: 1, fontWeight: "600" }}>
                    Karkas özellikleri
                  </Label>
                  <IconButton
                    icon={X}
                    label="Karkas panelini gizle"
                    onPress={() => w.setPanel(null)}
                  />
                </View>
                <FramingProperties workspace={w} />
              </View>
            )}
            {!tablet && <FramingToolbar workspace={w} />}
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
              <FramingProperties workspace={w} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

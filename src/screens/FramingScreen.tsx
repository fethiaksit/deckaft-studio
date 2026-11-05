import { View, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useMemo, useState } from "react";
import { estimateCutting } from "../modules/cutting/engine";
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const w = useFramingWorkspace(id);
  const { colors } = useTheme();
  const { tablet, height } = useResponsive();
  const [showCuts, setShowCuts] = useState(false);
  const cuts = useMemo(() => w.plan && !w.stale && !w.settingsDirty ? estimateCutting(w.plan) : null, [w.plan, w.stale, w.settingsDirty]);
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
          <View style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
            <Button
              title={showCuts ? "Kesim tahminini gizle" : "6 m Kesim Tahmini"}
              onPress={() => setShowCuts(!showCuts)}
            />
            {showCuts && (
              <ScrollView style={{ maxHeight: tablet ? 240 : 185, marginTop: 8 }}>
                <Label style={{ fontWeight: "700" }}>FAZ 03 — Ön Kesim Hesabı</Label>
                <Label muted style={{ fontSize: 11 }}>
                  Teknik/imalat onayı değildir. Kesimler 3 mm veya ayarlanan testere payıyla tahmin edilir.
                </Label>
                {!cuts ? (
                  <Label style={{ color: colors.danger }}>
                    Alan veya karkas ayarları değişti. Önce planı güncelleyin.
                  </Label>
                ) : (
                  <>
                    <Label>
                      {cuts.stocks.length} tam boy · {(cuts.totalPurchasedMm / 1000).toFixed(2)} m satın alma
                    </Label>
                    <Label muted>
                      Parça: {(cuts.totalPieceMm / 1000).toFixed(2)} m · Kesim kaybı: {cuts.totalKerfMm.toFixed(0)} mm · Kalan: {(cuts.totalRemainderMm / 1000).toFixed(2)} m
                    </Label>
                    {cuts.groups.map((g) => (
                      <Label key={g.sectionKey} style={{ fontSize: 11 }}>
                        {g.sectionKey.replaceAll("|", " / ")}: {g.stockCount} boy
                      </Label>
                    ))}
                    {cuts.stocks.map((bar) => (
                      <Label key={bar.id} style={{ fontSize: 11 }}>
                        {bar.id.split(":").at(-1)} — {bar.pieces.map((p) => `${p.code}: ${p.lengthMm.toFixed(0)}`).join(" + ")} mm · Kalan {bar.remainderMm.toFixed(0)} mm
                      </Label>
                    ))}
                    {cuts.exclusions.map((e) => (
                      <Label key={e.memberId} style={{ color: colors.danger, fontSize: 11 }}>
                        Hariç {e.code}: {e.reason}
                      </Label>
                    ))}
                    {cuts.warnings.map((warning, i) => (
                      <Label key={i} muted style={{ fontSize: 11 }}>{warning}</Label>
                    ))}
                  </>
                )}
              </ScrollView>
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

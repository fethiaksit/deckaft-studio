import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Button, Card, Field, Label, Page, StateView } from "../components/ui";
import { useResponsive, useTheme } from "../core/theme/theme";
import {
  useCuttingWorkspace,
  type CuttingDraft,
} from "../modules/cutting/hooks/useCuttingWorkspace";
import { CuttingBar } from "../modules/cutting/components/CuttingBar";
import { SourcePreview } from "../modules/cutting/components/SourcePreview";
const statusLabels = {
  optimal: "Optimal çözüm kanıtlandı",
  feasible: "Geçerli çözüm bulundu, optimalite kanıtlanmadı",
  "not-computed": "Hesaplanamadı",
  "invalid-input": "Geçersiz profil verisi",
};
export default function CuttingScreen() {
  const { id, memberId } = useLocalSearchParams<{
    id: string;
    memberId?: string;
  }>();
  const w = useCuttingWorkspace(id),
    { tablet } = useResponsive(),
    { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(memberId ?? null),
    [showSettings, setShowSettings] = useState(false),
    [showDetail, setShowDetail] = useState(!!memberId);
  useEffect(() => {
    setSelected(memberId ?? null);
    setShowDetail(!!memberId);
  }, [memberId, id]);
  const p = w.plan,
    current = !!p && !p.stale && !w.settingsDirty;
  const stock = current
    ? p.stocks.find((s) => s.pieces.some((c) => c.memberId === selected))
    : null;
  const piece = stock?.pieces.find((c) => c.memberId === selected);
  const source = current
    ? (JSON.parse(p.sourceRevision) as NonNullable<typeof w.source>)
    : null;
  const member = source?.members.find((m) => m.id === selected);
  const m = (n: number) => (n / 1000).toFixed(3);
  const cm = (n: number) => Number((n / 10).toFixed(3));
  const fields: [keyof CuttingDraft, string][] = [
    ["stockLengthMm", "Stok boyu (mm)"],
    ["cutKerfMm", "Testere payı (mm)"],
    ["startTrimMm", "Başlangıç uç düzeltme (mm)"],
    ["endTrimMm", "Son uç düzeltme (mm)"],
    ["minReusableMm", "Minimum kullanılabilir artık (mm)"],
  ];
  const detail = (
    <Card>
      <Label style={{ fontSize: 18, fontWeight: "700" }}>
        Parça ve karkas konumu
      </Label>
      {piece && stock && source && member ? (
        <>
          <Label style={{ fontWeight: "700" }}>
            Seçili profil: {piece.code}
          </Label>
          <Label>
            {piece.layer === "upper"
              ? "Üst karkas"
              : piece.layer === "lower"
                ? "Alt karkas"
                : "Çevre karkası"}{" "}
            · {stock.id}
          </Label>
          <Label>
            Kesim boyu {cm(piece.lengthMm)} cm · Gerçek boy{" "}
            {piece.actualLengthMm.toFixed(3)} mm
          </Label>
          <SourcePreview source={source} selected={piece.memberId} />
          <Label muted style={{ fontSize: 11 }}>
            Başlangıç ({member.start.x.toFixed(1)}, {member.start.y.toFixed(1)})
            → Bitiş ({member.end.x.toFixed(1)}, {member.end.y.toFixed(1)}) mm
          </Label>
          <Button
            title="Karkasta vurgula"
            variant="secondary"
            disabled={w.busy}
            onPress={async () => {
              if (w.dirty && !(await w.save())) return;
              setShowDetail(false);
              router.push({
                pathname: "/framing/[id]",
                params: { id, memberId: piece.memberId },
              });
            }}
          />
          <Label muted style={{ fontSize: 11 }}>
            Geçişte kaydedilmemiş kesim planı kaydedilir.
          </Label>
        </>
      ) : (
        <Label muted>Stok çubuğundan bir profil seçin.</Label>
      )}
    </Card>
  );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page
        title="Profil kesim planı"
        subtitle="FAZ 03 · İzlenebilir stok ve parça yerleşimi"
        back
      >
        {w.loading || w.loadError ? (
          <StateView
            title={w.loading ? "Kesim planı açılıyor" : "Kesim planı açılamadı"}
            loading={w.loading}
            description={w.loadError || undefined}
            action={
              w.loadError ? (
                <Button title="Tekrar dene" onPress={w.retry} />
              ) : undefined
            }
          />
        ) : (
          <>
            <Card style={{ borderColor: colors.accent }}>
              <Label style={{ fontWeight: "700", color: colors.accent }}>
                Ön Yerleşim — Teknik Onay Gerekli
              </Label>
              <Label muted>
                Kesim hesabı statik uygunluk veya imalat onayı sağlamaz.
                Bağlantı, mesnet ve ek tasarımı uyarıları kaynak karkasta
                korunur.
              </Label>
              <Button
                title={
                  showSettings ? "Kesim ayarlarını gizle" : "Kesim ayarları"
                }
                variant="secondary"
                onPress={() => setShowSettings((v) => !v)}
                disabled={w.busy}
              />
              {showSettings && (
                <>
                  {fields.map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      value={w.draft[key]}
                      keyboardType="decimal-pad"
                      onChangeText={(v) => w.setField(key, v)}
                      editable={!w.busy}
                    />
                  ))}
                  <Label muted>
                    Her parçaya son parça dahil bir kesim payı; her sıfırdan
                    büyük uç düzeltmesine ayrıca bir kesim payı eklenir. Fabrika
                    ucundan kesimsiz parça varsayılmaz. Minimum artık uzunluğu
                    ve üzeri saklanır.
                  </Label>
                </>
              )}
              <Button
                title="Kesim planını oluştur"
                onPress={() => void w.generate()}
                loading={w.busy}
                disabled={!w.source}
              />
              {!w.source && (
                <>
                  <Label>Önce karkas planını oluşturup kaydedin.</Label>
                  <Button
                    title="Karkas planını aç"
                    variant="secondary"
                    onPress={() =>
                      router.push({ pathname: "/framing/[id]", params: { id } })
                    }
                  />
                </>
              )}
            </Card>
            {w.error && (
              <Label accessibilityRole="alert" style={{ color: colors.danger }}>
                {w.error}
              </Label>
            )}
            {p && !current && (
              <Card style={{ borderColor: colors.danger }}>
                <Label
                  accessibilityRole="alert"
                  style={{ color: colors.danger, fontWeight: "700" }}
                >
                  {p.stale
                    ? "Geçersiz eski plan: karkas veya alan değişti."
                    : "Kesim ayarları değişti; planı yeniden oluşturun."}
                </Label>
                <Label muted>
                  Eski sonuç güncel satın alma veya imalat planı olarak
                  kullanılamaz.
                </Label>
              </Card>
            )}
            {p && current && (
              <>
                <Card>
                  <Label style={{ fontSize: 20, fontWeight: "700" }}>
                    {statusLabels[p.optimizationStatus]}
                  </Label>
                  {p.exclusions.length > 0 && (
                    <Label style={{ color: colors.danger, fontWeight: "600" }}>
                      Kısmi hesap · {p.exclusions.length} profil hariç
                    </Label>
                  )}
                  <Label style={{ fontWeight: "700" }}>
                    {p.stocks.length} adet · {cm(p.stockLengthMm)} cm stok
                  </Label>
                  <Label muted>
                    Kanıtlanan minimum stok:{" "}
                    {p.minimumStockCount ?? "kanıtlanmadı"} · Alt sınır:{" "}
                    {p.stockLowerBound} · Adet / alt sınır:{" "}
                    {p.qualityRatio?.toFixed(3) ?? "—"}
                  </Label>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}
                  >
                    {[
                      ["Satın alma tahmini", m(p.totalPurchasedMm) + " m"],
                      ["Kesilecek parça", m(p.totalPieceMm) + " m"],
                      ["Fire + testere + uç", m(p.totalWasteMm) + " m"],
                      [
                        "Kullanılabilir artık",
                        `${p.remnants.length} parça · ${m(p.totalReusableMm)} m`,
                      ],
                    ].map(([label, value]) => (
                      <View
                        key={label}
                        style={{ minWidth: 140, flexGrow: 1, gap: 3 }}
                      >
                        <Label muted style={{ fontSize: 12 }}>
                          {label}
                        </Label>
                        <Label style={{ fontSize: 18, fontWeight: "600" }}>
                          {value}
                        </Label>
                      </View>
                    ))}
                  </View>
                  <Label muted style={{ fontSize: 11 }}>
                    Dahil edilen profiller için stok adedi optimize edilir. Fire
                    dağılımının optimum olduğu iddia edilmez. Boylar 0,001 mm
                    üretim çözünürlüğünde yukarı yuvarlanır.
                  </Label>
                  <Button
                    title={
                      w.dirty ? "Kesim planını kaydet" : "Kesim planı kayıtlı"
                    }
                    onPress={() => void w.save()}
                    disabled={!w.dirty || w.busy}
                  />
                </Card>
                <View
                  testID={
                    tablet ? "cutting-tablet-layout" : "cutting-phone-layout"
                  }
                  style={{
                    flexDirection: tablet ? "row" : "column",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                >
                  <View
                    style={{
                      flex: tablet ? 1.7 : undefined,
                      width: tablet ? undefined : "100%",
                      minWidth: 0,
                      gap: 12,
                    }}
                  >
                    <Label style={{ fontSize: 18, fontWeight: "700" }}>
                      Stok kesim kombinasyonları
                    </Label>
                    <Label muted>
                      Çubuğu yatay kaydırın. Parçaya dokunarak karkastaki
                      konumunu görün. Turuncu: testere · Yeşil: kullanılabilir
                      artık · Kahverengi: kısa fire.
                    </Label>
                    {p.stocks.map((s) => (
                      <CuttingBar
                        key={s.id}
                        stock={s}
                        settings={p.settings}
                        selected={selected}
                        onSelect={(id) => {
                          setSelected(id);
                          setShowDetail(true);
                        }}
                      />
                    ))}
                    {!p.stocks.length && (
                      <Label>Kesime dahil edilebilen profil yok.</Label>
                    )}
                  </View>
                  <View
                    style={{
                      flex: tablet ? 1 : undefined,
                      width: tablet ? undefined : "100%",
                      minWidth: 0,
                      gap: 12,
                    }}
                  >
                    {tablet ? (
                      detail
                    ) : (
                      <Card>
                        <Label>Parça ve karkas konumu</Label>
                        <Button
                          title={
                            piece
                              ? `${piece.code} · Parça ayrıntısı`
                              : "Bir profil seçin"
                          }
                          variant="secondary"
                          disabled={!piece}
                          onPress={() => setShowDetail(true)}
                        />
                      </Card>
                    )}
                    <Card>
                      <Label style={{ fontWeight: "700" }}>
                        Hesap dışı profiller · {p.exclusions.length}
                      </Label>
                      {p.exclusions.map((e) => (
                        <Label
                          key={e.memberId}
                          style={{ color: colors.danger }}
                        >
                          {e.code} · {e.reason}
                        </Label>
                      ))}
                      {!p.exclusions.length && (
                        <Label muted>
                          Bütün profiller hesaba dahil edildi.
                        </Label>
                      )}
                    </Card>
                    <Card>
                      <Label style={{ fontWeight: "700" }}>
                        Artık envanteri · {p.remnants.length}
                      </Label>
                      {p.remnants.map((r) => (
                        <Label key={r.stockId}>
                          {r.stockId} · {cm(r.lengthMm)} cm ·{" "}
                          {r.sectionKey.replaceAll("|", " / ")}
                        </Label>
                      ))}
                      <Label muted>
                        Envanter kesim planıyla kaydedilir. Kaynak değişirse
                        artıklar eski olarak işaretlenir. Projeler arası
                        otomatik tüketim yapılmaz.
                      </Label>
                    </Card>
                  </View>
                </View>
                <Card>
                  <Label style={{ fontWeight: "700" }}>
                    Kaynak ve teknik uyarılar
                  </Label>
                  <Label muted>
                    Plan: {p.sourcePlanId} · Revizyon zamanı:{" "}
                    {p.sourcePlanUpdatedAt} · Hesap: {p.createdAt}
                  </Label>
                  {Array.from(new Set(p.warnings)).map((s, i) => (
                    <Label key={i} muted style={{ fontSize: 12 }}>
                      {s}
                      {p.warnings.filter((w) => w === s).length > 1
                        ? ` (${p.warnings.filter((w) => w === s).length} kayıt)`
                        : ""}
                    </Label>
                  ))}
                </Card>
              </>
            )}
          </>
        )}
      </Page>
      <Modal
        visible={!tablet && showDetail && current && !!piece}
        animationType="slide"
        onRequestClose={() => setShowDetail(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Button
              title="Parça ayrıntısını kapat"
              variant="secondary"
              onPress={() => setShowDetail(false)}
            />
            {detail}
            {w.error && (
              <Label accessibilityRole="alert" style={{ color: colors.danger }}>
                {w.error}
              </Label>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

import { useEffect, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Label, Button, Field, Card } from "../../../components/ui";
import { useTheme } from "../../../core/theme/theme";
import { parseLength } from "../../geometry/interaction";
import { FRAMING } from "../config";
import type { FramingLayer } from "../model";
import type { FramingWorkspace } from "../hooks/useFramingWorkspace";
import { FramingSettingsPanel } from "./FramingSettingsPanel";
const metres = (v: number) =>
  (v / 1000).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function LayerControls({
  workspace: w,
}: {
  workspace: FramingWorkspace;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        paddingVertical: 5,
      }}
    >
      {(
        [
          { key: "upper", label: "Üst" },
          { key: "lower", label: "Alt" },
          { key: "perimeter", label: "Çevre" },
        ] as const
      ).map(({ key, label }) => (
        <Pressable
          key={key}
          accessibilityRole="checkbox"
          accessibilityLabel={`${label} karkas görünür`}
          accessibilityState={{ checked: w.visibility[key] }}
          onPress={() => {
            w.setVisibility((v) => ({ ...v, [key]: !v[key] }));
            if (w.selected?.layer === key) w.select(null);
          }}
          style={{
            padding: 10,
            minHeight: 44,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: FRAMING.colors[key],
            opacity: w.visibility[key] ? 1 : 0.4,
          }}
        >
          <Label style={{ fontSize: 12, color: FRAMING.colors[key] }}>
            {label}
          </Label>
        </Pressable>
      ))}
    </View>
  );
}
export function FramingProperties({
  workspace: w,
}: {
  workspace: FramingWorkspace;
}) {
  const { colors } = useTheme();
  const m = w.selected;
  const [ax, setAX] = useState("0"),
    [ay, setAY] = useState("0"),
    [bx, setBX] = useState("0"),
    [by, setBY] = useState("1000");
  const [length, setLength] = useState("");
  const [fixed, setFixed] = useState<"start" | "end" | null>(null);
  const [filter, setFilter] = useState("");
  const [supportId, setSupportId] = useState<string | null>(null);
  const [sx, setSX] = useState(""),
    [sy, setSY] = useState("");
  const [supportType, setSupportType] = useState<"foot" | "bearing">("foot");
  useEffect(() => {
    if (m) {
      setAX(String(m.start.x));
      setAY(String(m.start.y));
      setBX(String(m.end.x));
      setBY(String(m.end.y));
      setLength(String(m.lengthMm));
    }
    setFixed(null);
  }, [m?.id, m?.start.x, m?.start.y, m?.end.x, m?.end.y]);
  const value = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : NaN);
  const start = () => ({ x: value(ax), y: value(ay) }),
    end = () => ({ x: value(bx), y: value(by) });
  const warnings = Object.values(
    (w.plan?.warnings ?? []).reduce<
      Record<string, { count: number; message: string }>
    >((all, warn) => {
      const key = warn.code;
      all[key] = { count: (all[key]?.count ?? 0) + 1, message: warn.message };
      return all;
    }, {}),
  );
  const stats = w.totals;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 14, gap: 14 }}
    >
      <View pointerEvents={w.saving ? "none" : "auto"} style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {(
            [
              { key: "plan", label: "Metraj" },
              { key: "settings", label: "Ayarlar" },
              { key: "profile", label: "Profil" },
            ] as const
          ).map((item) => (
            <Button
              key={item.key}
              title={item.label}
              variant={
                (w.panel ?? "plan") === item.key ? "primary" : "secondary"
              }
              onPress={() => w.setPanel(item.key)}
            />
          ))}
        </View>
        {w.error && (
          <Label
            accessibilityRole="alert"
            style={{ color: colors.danger, fontSize: 12 }}
          >
            {w.error}
          </Label>
        )}
        {w.panel === "settings" ? (
          <FramingSettingsPanel workspace={w} />
        ) : w.panel === "profile" ? (
          <>
            <Label style={{ fontWeight: "700" }}>
              {m ? `${m.code} · ${metres(m.lengthMm)} m` : "Yeni manuel profil"}
            </Label>
            {m && (
              <Label muted style={{ fontSize: 11 }}>
                {m.layer} · {m.method === "manual" ? "Manuel" : "Otomatik"}
                {m.section.widthMm}×{m.section.heightMm}×{m.section.wallMm} mm ·{" "}
                {m.section.material}
                Alt kot: {m.zBottomMm} mm · {m.connectionIds.length} temas
                {m.requiresSplice
                  ? "Stok aşımı — ek tasarımı gerekli"
                  : "Stok boyu içinde"}{" "}
                · Üretim onayı yok
              </Label>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {(["upper", "lower", "perimeter"] as const).map((layer) => (
                <Button
                  key={layer}
                  title={
                    layer === "upper"
                      ? "Üst"
                      : layer === "lower"
                        ? "Alt"
                        : "Çevre"
                  }
                  variant={
                    (m?.layer ?? w.newLayer) === layer ? "primary" : "secondary"
                  }
                  disabled={w.stale}
                  onPress={() => (m ? w.edit({ layer }) : w.setNewLayer(layer))}
                />
              ))}
            </View>
            {[
              { label: "Başlangıç X (mm)", val: ax, set: setAX },
              { label: "Başlangıç Y (mm)", val: ay, set: setAY },
              { label: "Bitiş X (mm)", val: bx, set: setBX },
              { label: "Bitiş Y (mm)", val: by, set: setBY },
            ].map((item) => (
              <Field
                key={item.label}
                label={item.label}
                value={item.val}
                onChangeText={item.set}
                keyboardType="numbers-and-punctuation"
              />
            ))}
            {m ? (
              <>
                <Button
                  title="Profili başlangıca taşı"
                  disabled={w.stale}
                  variant="secondary"
                  onPress={() => w.moveTo(start())}
                />
                <Button
                  title="İki ucu uygula"
                  disabled={w.stale}
                  onPress={() => w.edit({ start: start(), end: end() })}
                />
                <Field
                  label="Profil uzunluğu (mm/cm/m)"
                  value={length}
                  onChangeText={setLength}
                  keyboardType="numbers-and-punctuation"
                />
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Button
                    title="Başlangıç sabit"
                    variant={fixed === "start" ? "primary" : "secondary"}
                    onPress={() => setFixed("start")}
                  />
                  <Button
                    title="Bitiş sabit"
                    variant={fixed === "end" ? "primary" : "secondary"}
                    onPress={() => setFixed("end")}
                  />
                </View>
                <Button
                  title="Profil boyunu uygula"
                  disabled={w.stale || !fixed}
                  onPress={() => {
                    let lengthMm = NaN;
                    try {
                      lengthMm = parseLength(length);
                    } catch {}
                    w.edit({ lengthMm, fixed: fixed ?? undefined });
                  }}
                />
                <Button
                  title="Seçili profili sil"
                  disabled={w.stale}
                  variant="danger"
                  onPress={w.deleteSelected}
                />
                <Button
                  title="Yeni profil girişine geç"
                  variant="secondary"
                  onPress={() => w.select(null)}
                />
              </>
            ) : (
              <Button
                title="Manuel profil ekle"
                disabled={!w.plan || w.stale}
                onPress={() =>
                  w.add({ start: start(), end: end(), layer: w.newLayer })
                }
              />
            )}
            <Card style={{ padding: 12 }}>
              <Label style={{ fontWeight: "600" }}>Ayak / mesnet</Label>
              <Label muted style={{ fontSize: 11 }}>
                Alt profil seçiliyse ona bağlanır. Konum/temas kontrolü statik
                veya zemin onayı değildir.
              </Label>
              <Field
                label="Mesnet X (mm)"
                value={sx}
                onChangeText={setSX}
                keyboardType="numbers-and-punctuation"
              />
              <Field
                label="Mesnet Y (mm)"
                value={sy}
                onChangeText={setSY}
                keyboardType="numbers-and-punctuation"
              />
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Button
                  title="Ayak"
                  variant={supportType === "foot" ? "primary" : "secondary"}
                  onPress={() => setSupportType("foot")}
                />
                <Button
                  title="Mesnet"
                  variant={supportType === "bearing" ? "primary" : "secondary"}
                  onPress={() => setSupportType("bearing")}
                />
              </View>
              <Button
                title={supportId ? "Mesneti güncelle" : "Mesnet ekle"}
                disabled={!w.plan || w.stale}
                onPress={() =>
                  w.support({
                    id: supportId ?? undefined,
                    at: { x: value(sx), y: value(sy) },
                    type: supportType,
                    memberId:
                      m?.layer === "lower"
                        ? m.id
                        : (w.plan?.supports.find((s) => s.id === supportId)
                            ?.memberId ?? null),
                  })
                }
              />
              {supportId && (
                <>
                  <Button
                    title="Mesneti sil"
                    variant="danger"
                    onPress={() => {
                      w.deleteSupport(supportId);
                      setSupportId(null);
                    }}
                  />
                  <Button
                    title="Yeni mesnet"
                    variant="secondary"
                    onPress={() => setSupportId(null)}
                  />
                </>
              )}
              <Field
                label="Mesnet / profil kodu ara"
                value={filter}
                onChangeText={setFilter}
              />
              {w.plan?.supports
                .filter((s) =>
                  s.id.toLowerCase().includes(filter.toLowerCase()),
                )
                .slice(0, 30)
                .map((s) => (
                  <Pressable
                    key={s.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setSupportId(s.id);
                      setSX(String(s.at.x));
                      setSY(String(s.at.y));
                      setSupportType(s.type);
                    }}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <Label muted style={{ fontSize: 10 }}>
                      {s.id} · {s.at.x.toFixed(0)}, {s.at.y.toFixed(0)}
                    </Label>
                  </Pressable>
                ))}
            </Card>
          </>
        ) : (
          <>
            <Label style={{ fontWeight: "700", color: colors.accent }}>
              {FRAMING.statusLabel}
            </Label>
            <Button
              title="Karkas Oluştur"
              disabled={w.saving}
              onPress={w.generate}
            />
            <LayerControls workspace={w} />
            {stats ? (
              <Card style={{ padding: 12 }}>
                <Label>
                  Üst: {stats.upperCount} adet · {metres(stats.upperLengthMm)} m
                </Label>
                <Label>
                  Alt: {stats.lowerCount} adet · {metres(stats.lowerLengthMm)} m
                </Label>
                <Label>Çevre: {metres(stats.perimeterLengthMm)} m</Label>
                <Label style={{ fontWeight: "700" }}>
                  Toplam: {metres(stats.totalLengthMm)} m
                </Label>
                <Label muted style={{ fontSize: 11 }}>
                  Deck birleşimi: {stats.jointCount}
                  Ayak/mesnet: {stats.supportCount} · Katman teması:{" "}
                  {stats.connectionCount}
                </Label>
                <Label muted style={{ fontSize: 11 }}>
                  Fiziksel hatlar tam boylarıyla sayılır; kesişimlerde kesit
                  düşülmez. Stok aşımı üretim parçası değildir.
                </Label>
              </Card>
            ) : (
              <Label muted>
                Alanı okuyup ilk karkas ön yerleşimini oluşturun. Eksik tahta ve
                alt karkas ayarları uyarı olarak gösterilir.
              </Label>
            )}
            {warnings.map((warning, i) => (
              <Label key={i} style={{ fontSize: 11, color: colors.danger }}>
                • {warning.message}
                {warning.count > 1 ? ` (${warning.count})` : ""}
              </Label>
            ))}
            {w.plan && (
              <>
                <Field
                  label="Profil kodu ara"
                  value={filter}
                  onChangeText={setFilter}
                />
                {w.plan.members
                  .filter((m) =>
                    `${m.code} ${m.layer}`
                      .toLowerCase()
                      .includes(filter.toLowerCase()),
                  )
                  .slice(0, 50)
                  .map((m) => (
                    <Pressable
                      key={m.id}
                      accessibilityRole="button"
                      onPress={() => w.select(m.id)}
                      style={{
                        minHeight: 44,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <Label
                        style={{
                          fontSize: 12,
                          color:
                            m.role === "jointSupport"
                              ? FRAMING.colors.joint
                              : FRAMING.colors[m.layer],
                        }}
                      >
                        {m.code}
                      </Label>
                      <Label muted style={{ fontSize: 12 }}>
                        {metres(m.lengthMm)} m
                      </Label>
                    </Pressable>
                  ))}
                <Label muted style={{ fontSize: 10 }}>
                  İlk 50 eşleşme gösterilir. Seçim için çizime de
                  dokunabilirsiniz.
                </Label>
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

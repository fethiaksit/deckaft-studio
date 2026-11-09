import { useEffect, useState } from "react";
import { View, ScrollView, Switch, Pressable, Platform } from "react-native";
import { Button, Field, Label, Card } from "../../../components/ui";
import { useTheme } from "../../../core/theme/theme";
import { voidKinds, type VoidKind, type PathRole } from "../model";
import { length } from "../../geometry/engine";
import type { DrawingWorkspace } from "../hooks/useDrawingWorkspace";
import { AreaSummary } from "./AreaSummary";
function Choice<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {items.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === item.value }}
          onPress={() => onChange(item.value)}
          style={{
            paddingHorizontal: 11,
            paddingVertical: 10,
            minHeight: 44,
            borderRadius: 9,
            backgroundColor:
              value === item.value ? colors.accent : colors.raised,
          }}
        >
          <Label
            style={{
              fontSize: 12,
              color: value === item.value ? colors.accentText : colors.text,
            }}
          >
            {item.label}
          </Label>
        </Pressable>
      ))}
    </View>
  );
}
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 44,
        gap: 8,
      }}
    >
      <Label style={{ flex: 1, fontSize: 12 }}>{label}</Label>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={value ? colors.accentText : colors.muted}
      />
    </View>
  );
}
export function DrawingProperties({
  workspace: w,
}: {
  workspace: DrawingWorkspace;
}) {
  const { colors } = useTheme();
  const path = w.selectedPath ?? w.activePath;
  const s = w.selection;
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [edgeText, setEdgeText] = useState("");
  const [unit, setUnit] = useState<"mm" | "cm" | "m">("cm");
  const [choices, setChoices] = useState<("start" | "end")[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [fixed, setFixed] = useState<"start" | "end" | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<VoidKind>("Ev");
  const [newName, setNewName] = useState("");
  const [grid, setGrid] = useState(String(w.document.snap.gridMm));
  const factor = { mm: 1, cm: 10, m: 1000 }[unit];
  const edge =
    s?.kind === "edge" && path
      ? {
          a: path.points[s.index],
          b: path.points[(s.index + 1) % path.points.length],
        }
      : null;
  const edgeLength = edge?.a && edge.b ? length(edge.a, edge.b) : null;
  const selectedPoint =
    s?.kind === "vertex" && path ? path.points[s.index] : null;
  useEffect(() => {
    setFixed(null);
    setChoices([]);
  }, [
    s?.kind,
    s && s.kind !== "dimension" ? s.pathId : "",
    s && s.kind !== "dimension" ? s.index : -1,
  ]);
  useEffect(() => {
    setEdgeText(edgeLength === null ? "" : String(edgeLength / factor));
    setChoices([]);
  }, [
    edgeLength,
    factor,
    s?.kind,
    s?.kind === "edge" ? s.pathId : null,
    s?.kind === "edge" ? s.index : null,
  ]);
  useEffect(() => {
    setX(selectedPoint ? String(selectedPoint.x) : "");
    setY(selectedPoint ? String(selectedPoint.y) : "");
  }, [selectedPoint?.x, selectedPoint?.y, s?.kind]);
  useEffect(() => {
    setName(path?.name ?? "");
  }, [path?.id, path?.name]);
  useEffect(
    () => setGrid(String(w.document.snap.gridMm)),
    [w.document.snap.gridMm],
  );
  const lock =
    s?.kind === "edge"
      ? path?.constraints?.find((c) => c.index === s.index)
      : undefined;
  const lengthInput = /(?:mm|cm|m)\s*$/i.test(edgeText)
    ? edgeText
    : `${edgeText} ${unit}`;
  const ends =
    s?.kind === "edge" && path
      ? [
          { value: "start" as const, label: `Köşe ${s.index + 1} sabit` },
          {
            value: "end" as const,
            label: `Köşe ${((s.index + 1) % path.points.length) + 1} sabit`,
          },
        ]
      : [];
  const keyboard =
    Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric";
  function applyCoordinate() {
    const px = Number(x.replace(",", ".")),
      py = Number(y.replace(",", "."));
    if (
      !x.trim() ||
      !y.trim() ||
      !Number.isFinite(px) ||
      !Number.isFinite(py)
    ) {
      w.move({ x: NaN, y: NaN });
      return;
    }
    if (s?.kind === "vertex") w.move({ x: px, y: py });
    else w.point({ x: px, y: py }, false);
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 14, gap: 16 }}
    >
      <View pointerEvents={w.saving ? "none" : "auto"} style={{ gap: 16 }}>
        <AreaSummary report={w.report} />
        <Choice
          items={[
            { value: "sketch", label: "Basit Kroki" },
            { value: "technical", label: "Hassas Teknik" },
          ]}
          value={w.mode}
          onChange={(mode) => {
            w.setMode(mode);
            setChoices([]);
            setFixed(null);
          }}
        />
        {w.error ? (
          <Label
            accessibilityRole="alert"
            style={{ color: colors.danger, fontSize: 12 }}
          >
            {w.error}
          </Label>
        ) : null}
        {s?.kind === "edge" && edgeLength !== null && (
          <Card style={{ padding: 12 }}>
            <Label style={{ fontWeight: "700" }}>
              Kenar {s.index + 1} ·{" "}
              {(edgeLength / 1000).toLocaleString("tr-TR", {
                maximumFractionDigits: 6,
              })}{" "}
              m
            </Label>
            <Label muted style={{ fontSize: 11 }}>
              Yalnız seçilen kenarın bir ucu taşınır. O köşeye bağlı komşu
              kenarın boyu değişebilir.
            </Label>
            <Field
              label={`Yeni kenar uzunluğu (${unit})`}
              value={edgeText}
              onChangeText={(value) => {
                setEdgeText(value);
                setChoices([]);
              }}
              keyboardType={keyboard}
              placeholder="250 cm / 3,75 m / 1250 mm"
            />
            <Choice
              items={(["mm", "cm", "m"] as const).map((value) => ({
                value,
                label: value,
              }))}
              value={unit}
              onChange={setUnit}
            />
            {w.mode === "sketch" ? (
              <>
                <Button
                  title="Uzunluğu uygula"
                  onPress={() => setChoices(w.prepareResize(lengthInput))}
                />
                {choices.length > 1 && (
                  <>
                    <Label>İki uç da uygun. Hangi köşe sabit kalsın?</Label>
                    <View style={{ gap: 6 }}>
                      {ends.map((end) => (
                        <Button
                          key={end.value}
                          title={end.label}
                          variant="secondary"
                          onPress={() => {
                            w.resize(lengthInput, end.value);
                            setChoices([]);
                          }}
                        />
                      ))}
                    </View>
                  </>
                )}
              </>
            ) : (
              <>
                <Choice items={ends} value={fixed} onChange={setFixed} />
                <Button
                  title="Uzunluğu uygula"
                  disabled={!fixed}
                  onPress={() => fixed && w.resize(lengthInput, fixed)}
                />
                <Toggle
                  label="Kenar boyunu kilitle"
                  value={lock?.lengthMm !== undefined}
                  onChange={(enabled) =>
                    w.constrain(
                      {
                        axis: lock?.axis,
                        lengthMm: enabled ? edgeLength : undefined,
                      },
                      fixed ?? undefined,
                    )
                  }
                />
                <Label muted>
                  Yönü değiştirmek için sabit köşeyi seçin. Kısıtlar yalnız
                  geçerli bir düzenleme kaydedildiğinde uygulanır.
                </Label>
                <Button
                  title="Yatay kısıt"
                  variant="secondary"
                  disabled={!fixed}
                  onPress={() =>
                    fixed &&
                    w.constrain(
                      { axis: "horizontal", lengthMm: lock?.lengthMm },
                      fixed,
                    )
                  }
                />
                <Button
                  title="Dikey kısıt"
                  variant="secondary"
                  disabled={!fixed}
                  onPress={() =>
                    fixed &&
                    w.constrain(
                      { axis: "vertical", lengthMm: lock?.lengthMm },
                      fixed,
                    )
                  }
                />
                {lock?.axis && (
                  <Button
                    title="Yön kısıtını kaldır"
                    variant="secondary"
                    onPress={() => w.constrain({ lengthMm: lock.lengthMm })}
                  />
                )}
              </>
            )}
          </Card>
        )}
        {s?.kind === "dimension" && (
          <Card style={{ padding: 12 }}>
            <Label>
              Bağımsız ölçü:{" "}
              {w.document.dimensions
                .find((m) => m.id === s.id)
                ?.lengthMm.toLocaleString("tr-TR")}{" "}
              mm
            </Label>
            <Label muted style={{ fontSize: 11 }}>
              Geometriyi değiştirmek için alanın kenarını seçin. Bu çizgi
              bağımsız bir referans ölçüsüdür.
            </Label>
          </Card>
        )}
        {w.mode === "technical" &&
          (s?.kind === "vertex" ||
            w.tool === "draw" ||
            w.tool === "measure") && (
            <Card style={{ padding: 12 }}>
              <Label style={{ fontWeight: "600" }}>
                {s?.kind === "vertex"
                  ? `Köşe ${s.index + 1} · Hassas taşıma`
                  : "Hassas nokta girişi"}
              </Label>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="X (mm)"
                    value={x}
                    onChangeText={setX}
                    keyboardType={keyboard}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Y (mm)"
                    value={y}
                    onChangeText={setY}
                    keyboardType={keyboard}
                  />
                </View>
              </View>
              <Button
                title={s?.kind === "vertex" ? "Köşeyi taşı" : "Nokta ekle"}
                onPress={applyCoordinate}
              />
              {s?.kind === "vertex" && (
                <Button
                  title="Yakındaki köşeyle birleştir"
                  variant="secondary"
                  onPress={w.merge}
                />
              )}
              <Label muted style={{ fontSize: 11 }}>
                Elle girilen mm değerine yakalama uygulanmaz. Taşı aracıyla
                köşeyi sürükleyebilirsiniz.
              </Label>
            </Card>
          )}
        {path &&
          !path.closed &&
          path.role !== "void" &&
          path.points.length >= 2 && (
            <Button
              title="Çizgileri Birleştir"
              variant="secondary"
              onPress={w.join}
            />
          )}
        {path && (w.mode === "technical" || advanced) && (
          <Card style={{ padding: 12 }}>
            <Label style={{ fontSize: 11, color: colors.accent }}>
              {path.closed ? "KAPALI" : "AÇIK"} · {path.points.length} KÖŞE
            </Label>
            <Field
              label="Alan adı"
              value={name}
              onChangeText={setName}
              maxLength={120}
            />
            <Button
              title="Adı güncelle"
              variant="secondary"
              onPress={() => w.properties({ name })}
            />
            <Choice<PathRole>
              items={[
                { value: "outer", label: "Dış sınır" },
                { value: "void", label: "İç boşluk" },
                { value: "draft", label: "Serbest çizgi" },
              ]}
              value={path.role}
              onChange={(role) => w.properties({ role, kind })}
            />
            {path.role === "void" && (
              <Choice
                items={voidKinds.map((v) => ({ value: v, label: v }))}
                value={path.kind ?? "Özel boşluk"}
                onChange={(value) => w.properties({ kind: value })}
              />
            )}
            <Button
              title="Alanı kapat"
              variant="secondary"
              disabled={path.closed || path.points.length < 3}
              onPress={w.close}
            />
            {w.selection && (
              <Button
                title={
                  s?.kind === "dimension" ? "Ölçüyü sil" : "Seçili alanı sil"
                }
                variant="danger"
                onPress={w.remove}
              />
            )}
          </Card>
        )}
        <Card style={{ padding: 12 }}>
          <Label style={{ fontWeight: "600" }}>Yeni alan / çizgi</Label>
          {!w.document.paths.some((p) => p.role === "outer") && (
            <Button
              title="Dış alanı başlat"
              onPress={() => w.newRegion("outer", "Dış alan")}
            />
          )}
          <Choice
            items={voidKinds.map((v) => ({ value: v, label: v }))}
            value={kind}
            onChange={setKind}
          />
          <Field
            label="Yeni boşluk adı"
            value={newName}
            maxLength={120}
            onChangeText={setNewName}
            placeholder={kind}
          />
          <Button
            title={`${kind} boşluğu çiz`}
            disabled={
              !w.document.paths.some((p) => p.role === "outer" && p.closed)
            }
            onPress={() => {
              w.newRegion("void", newName.trim() || kind, kind);
              w.setPanel(false);
            }}
          />
          <Button
            title="Yeni serbest çizgi"
            variant="secondary"
            onPress={() => w.newRegion("draft", "Serbest çizgi")}
          />
          <Label muted style={{ fontSize: 11 }}>
            İlk köşeye dokunarak veya ✓ aracıyla kapatın. Boşluklar dış sınır
            içinde olmalı.
          </Label>
        </Card>
        <Button
          title={
            advanced ? "Gelişmiş seçenekleri gizle" : "Gelişmiş seçenekler"
          }
          variant="secondary"
          onPress={() => setAdvanced((a) => !a)}
        />
        {(advanced || w.mode === "technical") && (
          <>
            <Card style={{ padding: 12 }}>
              <Label style={{ fontWeight: "600" }}>Katmanlar</Label>
              {(
                [
                  { key: "outer", label: "Dış sınır ve serbest çizgiler" },
                  { key: "voids", label: "İç boşluklar" },
                  { key: "dimensions", label: "Ölçüler ve kenar etiketleri" },
                  { key: "grid", label: "Izgara ve yardımcı çizgiler" },
                ] as const
              ).map(({ key, label }) => (
                <Toggle
                  key={key}
                  label={label}
                  value={w.document.layers[key]}
                  onChange={(value) =>
                    w.updateSettings({
                      layers: { ...w.document.layers, [key]: value },
                    })
                  }
                />
              ))}
              <Label muted style={{ fontSize: 11 }}>
                Görünürlük hesabı değiştirmez.
              </Label>
            </Card>
            <Card style={{ padding: 12 }}>
              <Label style={{ fontWeight: "600" }}>Akıllı yakalama</Label>
              {(
                [
                  { key: "vertices", label: "Yakındaki köşeler" },
                  { key: "axes", label: "Yatay / dikey · 90°" },
                  { key: "grid", label: "Izgara noktaları" },
                ] as const
              ).map(({ key, label }) => (
                <Toggle
                  key={key}
                  label={label}
                  value={w.document.snap[key]}
                  onChange={(value) =>
                    w.updateSettings({
                      snap: { ...w.document.snap, [key]: value },
                    })
                  }
                />
              ))}
              <Field
                label="Yakalama ızgarası (mm)"
                value={grid}
                onChangeText={setGrid}
                keyboardType={keyboard}
              />
              <Button
                title="Izgara aralığını uygula"
                variant="secondary"
                onPress={() =>
                  w.updateSettings({
                    snap: {
                      ...w.document.snap,
                      gridMm: Number(grid.replace(",", ".")),
                    },
                  })
                }
              />
              <Label muted style={{ fontSize: 11 }}>
                Yakalama toleransı ekran ölçeğine göre 12 pikseldir. Görüntü
                ızgarası okunabilirlik için aralığın katlarını gösterebilir.
              </Label>
            </Card>
          </>
        )}
        <Label muted style={{ fontSize: 11 }}>
          Milimetre modeli · {w.project?.city} / {w.project?.district}
          Değişiklikleri Kaydet ile bu cihaza yazın.
        </Label>
      </View>
    </ScrollView>
  );
}

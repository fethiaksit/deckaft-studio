import { View, Switch } from "react-native";
import { Button, Field, Label, Card } from "../../../components/ui";
import type { FramingSettings } from "../model";
import type { FramingWorkspace } from "../hooks/useFramingWorkspace";
import {
  framingSettingFields as fields,
  settingsToDraft,
  draftToSettings,
} from "../form";
export function FramingSettingsPanel({
  workspace: w,
}: {
  workspace: FramingWorkspace;
}) {
  const draft = w.settingsDraft ?? settingsToDraft(w.settings);
  const { values, sections, direction, double, material } = draft;
  const setValues = (
    updater: (values: Record<string, string>) => Record<string, string>,
  ) => w.setSettingsDraft({ ...draft, values: updater(values) });
  const setSections = (
    updater: (values: Record<string, string>) => Record<string, string>,
  ) => w.setSettingsDraft({ ...draft, sections: updater(sections) });
  const setDirection = (direction: FramingSettings["deckDirection"]) =>
    w.setSettingsDraft({ ...draft, direction });
  const setDouble = (value: boolean) =>
    w.setSettingsDraft({ ...draft, double: value });
  const setMaterial = (material: FramingSettings["upperSection"]["material"]) =>
    w.setSettingsDraft({ ...draft, material });
  function apply() {
    w.generateWith(draftToSettings(w.settings, draft));
  }
  return (
    <View style={{ gap: 14 }}>
      <Label style={{ fontWeight: "700" }}>Karkas ayarları</Label>
      <Label muted style={{ fontSize: 11 }}>
        Form Oluştur ile uygulanır. Boş alt aralıklar güvenli bir değere tahmin
        edilmez. Kesitler statik onay anlamına gelmez.
      </Label>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Button
          title="Yatay deck"
          variant={direction === "horizontal" ? "primary" : "secondary"}
          onPress={() => setDirection("horizontal")}
        />
        <Button
          title="Dikey deck"
          variant={direction === "vertical" ? "primary" : "secondary"}
          onPress={() => setDirection("vertical")}
        />
      </View>
      <Label muted style={{ fontSize: 11 }}>
        İki katman · İç birim mm · Üst yön deck'e dik, alt yön deck'e paralel.
      </Label>
      {fields.map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={values[key] ?? ""}
          onChangeText={(v) => setValues((s) => ({ ...s, [key]: v }))}
          keyboardType="decimal-pad"
          placeholder={
            w.settings[key] === null ? "Kullanıcı belirlemeli" : undefined
          }
        />
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Label style={{ flex: 1 }}>Deck eklerinde çift destek</Label>
        <Switch
          accessibilityLabel="Deck eklerinde çift destek"
          value={double}
          onValueChange={setDouble}
        />
      </View>
      <Label muted style={{ fontSize: 11 }}>
        Montaj boşluğu çift destek yüzeyleri arasındaki minimum açıklıktır; deck
        derzi bunu karşılamıyorsa uç desteği doğrulanmaz.
      </Label>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Button
          title="Çelik"
          variant={material === "steel" ? "primary" : "secondary"}
          onPress={() => setMaterial("steel")}
        />
        <Button
          title="Alüminyum"
          variant={material === "aluminium" ? "primary" : "secondary"}
          onPress={() => setMaterial("aluminium")}
        />
      </View>
      {(
        [
          { key: "upperSection", label: "Üst profil" },
          { key: "lowerSection", label: "Alt profil" },
          { key: "perimeterSection", label: "Çevre profili" },
        ] as const
      ).map(({ key, label }) => (
        <Card key={key} style={{ padding: 12 }}>
          <Label style={{ fontWeight: "600" }}>{label} kesiti</Label>
          {(
            [
              { field: "widthMm", label: "Genişlik (mm)" },
              { field: "heightMm", label: "Yükseklik (mm)" },
              { field: "wallMm", label: "Et kalınlığı (mm)" },
            ] as const
          ).map((item) => (
            <Field
              key={item.field}
              label={`${label} ${item.label}`}
              value={sections[`${key}.${item.field}`] ?? ""}
              onChangeText={(v) =>
                setSections((s) => ({ ...s, [`${key}.${item.field}`]: v }))
              }
              keyboardType="decimal-pad"
            />
          ))}
        </Card>
      ))}
      <Button
        title="Ayarlarla Karkas Oluştur"
        disabled={w.saving}
        onPress={apply}
      />
      <Label muted style={{ fontSize: 11 }}>
        6000 mm stok boyu ve 3 mm testere payı kesim optimizasyonu yapmaz. Stok
        aşımı ek tasarımı gerektirir.
      </Label>
    </View>
  );
}

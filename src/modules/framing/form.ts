import type { FramingSettings } from "./model";
export const framingSettingFields = [
  ["deckLengthMm", "Deck uzunluğu (mm)"],
  ["stockLengthMm", "Stok boyu (mm)"],
  ["upperMaxSpacingMm", "Maksimum üst aks (mm)"],
  ["lowerSpacingMm", "Alt karkas aralığı (mm)"],
  ["supportSpacingMm", "Ayak / mesnet aralığı (mm)"],
  ["boardWidthMm", "Tahta genişliği (mm)"],
  ["boardGapMm", "Tahta sıraları arası derz (mm)"],
  ["edgeGapMm", "Deck kenar boşluğu (mm)"],
  ["jointGapMm", "Deck boy ek derzi (mm)"],
  ["installationGapMm", "Çift profil arası minimum boşluk (mm)"],
  ["kerfMm", "Testere payı — yalnız kayıt (mm)"],
  ["designLoadKnM2", "Tasarım yükü (kN/m², opsiyonel)"],
  ["allowableSpanMm", "Onaylı açıklık verisi (mm, opsiyonel)"],
] as const;
export interface FramingSettingsDraft {
  values: Record<string, string>;
  sections: Record<string, string>;
  direction: FramingSettings["deckDirection"];
  double: boolean;
  material: FramingSettings["upperSection"]["material"];
}
export function settingsToDraft(s: FramingSettings): FramingSettingsDraft {
  return {
    values: Object.fromEntries(
      framingSettingFields.map(([key]) => [
        key,
        s[key] === null ? "" : String(s[key]),
      ]),
    ),
    sections: Object.fromEntries(
      (["upperSection", "lowerSection", "perimeterSection"] as const).flatMap(
        (key) =>
          (["widthMm", "heightMm", "wallMm"] as const).map((field) => [
            `${key}.${field}`,
            String(s[key][field]),
          ]),
      ),
    ),
    direction: s.deckDirection,
    double: s.doubleJointSupport,
    material: s.upperSection.material,
  };
}
export function draftToSettings(
  base: FramingSettings,
  d: FramingSettingsDraft,
): FramingSettings {
  const s = {
    ...base,
    deckDirection: d.direction,
    doubleJointSupport: d.double,
  };
  for (const [key] of framingSettingFields) {
    const text = d.values[key] ?? "";
    const nullable = [
      "boardWidthMm",
      "boardGapMm",
      "edgeGapMm",
      "jointGapMm",
      "installationGapMm",
      "lowerSpacingMm",
      "supportSpacingMm",
      "designLoadKnM2",
      "allowableSpanMm",
    ].includes(key);
    (s as unknown as Record<string, unknown>)[key] = text.trim()
      ? Number(text.replace(",", "."))
      : nullable
        ? null
        : NaN;
  }
  for (const key of [
    "upperSection",
    "lowerSection",
    "perimeterSection",
  ] as const)
    s[key] = {
      widthMm: Number(d.sections[`${key}.widthMm`]?.replace(",", ".")),
      heightMm: Number(d.sections[`${key}.heightMm`]?.replace(",", ".")),
      wallMm: Number(d.sections[`${key}.wallMm`]?.replace(",", ".")),
      material: d.material,
    };
  return s;
}

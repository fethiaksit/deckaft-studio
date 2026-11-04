export const APP = {
  name: "DeckAft Studio",
  phase: "FAZ 01",
  database: "deckaft-studio.db",
  contentMaxWidth: 1120,
  minTouchSize: 44,
} as const;
export const modules = {
  maps: {
    title: "Ada / Parsel Sorgulama",
    description:
      "Resmî veri kaynağı bağlantısı ve parsel sınırları sonraki fazlarda eklenecek.",
    icon: "map",
  },
  framing: {
    title: "Karkas Planı",
    description:
      "Profil yerleşimi ve karkas hesaplama motoru sonraki fazlarda eklenecek.",
    icon: "layers",
  },
  cutting: {
    title: "Malzeme ve Kesim Listesi",
    description:
      "Malzeme kataloğu ve profil kesim optimizasyonu sonraki fazlarda eklenecek.",
    icon: "scissors",
  },
  exports: {
    title: "PDF Çıktılar",
    description:
      "Teknik çizim ve malzeme raporlarının PDF çıktıları sonraki fazlarda eklenecek.",
    icon: "file",
  },
} as const;
export type ModuleId = keyof typeof modules;

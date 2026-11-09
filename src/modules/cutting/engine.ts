import type { FramingPlan, FramingMember } from "../framing/model";
import type {
  CutPiece,
  CutStock,
  CuttingEstimate,
  CuttingExclusion,
  CuttingGroup,
  CuttingOptions,
  CuttingSettings,
} from "./model";
import { packStock } from "./solver";
export type { CutPiece, CutStock, CuttingEstimate } from "./model";
// Manufacturing lengths/kerf/trims round UP to 0.001 mm; capacity rounds DOWN.
// Snap only IEEE-754 multiplication noise at an integer micrometre boundary.
const scaled = (n: number) => {
  const value = n * 1000,
    nearest = Math.round(value);
  return Math.abs(value - nearest) <=
    Number.EPSILON * Math.max(1, Math.abs(value)) * 4
    ? nearest
    : value;
};
const up = (n: number) => Math.ceil(scaled(n)) / 1000;
export const sectionKeyOf = (m: FramingMember): string =>
  [
    m.section.material,
    m.section.widthMm,
    m.section.heightMm,
    m.section.wallMm,
  ].join("|");
export function cuttingSettings(
  plan: FramingPlan,
  o: CuttingOptions = {},
): CuttingSettings {
  const s: CuttingSettings = {
    stockLengthMm: o.stockLengthMm ?? plan.settings.stockLengthMm,
    cutKerfMm: o.cutKerfMm ?? plan.settings.kerfMm,
    startTrimMm: o.startTrimMm ?? 0,
    endTrimMm: o.endTrimMm ?? 0,
    minReusableMm: o.minReusableMm ?? 500,
    cutRule: "per-piece-and-trim",
    resolutionMm: 0.001,
  };
  for (const [key, n] of Object.entries(s))
    if (typeof n === "number" && (!Number.isFinite(n) || n < 0 || n > 1e7))
      throw Error(`Geçersiz kesim/testere ayarı: ${key}`);
  s.stockLengthMm = Math.floor(scaled(s.stockLengthMm)) / 1000;
  s.cutKerfMm = up(s.cutKerfMm);
  s.startTrimMm = up(s.startTrimMm);
  s.endTrimMm = up(s.endTrimMm);
  if (s.stockLengthMm <= 0 || s.cutKerfMm >= s.stockLengthMm)
    throw Error("Geçersiz stok boyu veya testere payı.");
  if (
    s.startTrimMm +
      s.endTrimMm +
      s.cutKerfMm * ((s.startTrimMm > 0 ? 1 : 0) + (s.endTrimMm > 0 ? 1 : 0)) >=
    s.stockLengthMm
  )
    throw Error("Uç düzeltmeleri stok boyunu tüketiyor.");
  return s;
}
export function estimateCutting(
  plan: FramingPlan,
  o: CuttingOptions = {},
): CuttingEstimate {
  if (
    !plan ||
    plan.version !== 1 ||
    plan.technicalStatus !== "requires-approval" ||
    !Array.isArray(plan.members)
  )
    throw Error("Karkas planı sürümü veya teknik durumu geçersiz.");
  if (plan.members.length > 20000)
    throw Error("Kesim profil hesap sınırı aşıldı.");
  const settings = cuttingSettings(plan, o),
    stockMm = settings.stockLengthMm,
    kerf = settings.cutKerfMm;
  const maxNodes = o.maxSearchNodes ?? 250000,
    maxMs = o.maxSearchMs ?? 150;
  if (
    !Number.isSafeInteger(maxNodes) ||
    maxNodes < 0 ||
    maxNodes > 2000000 ||
    !Number.isFinite(maxMs) ||
    maxMs < 0 ||
    maxMs > 2000
  )
    throw Error("Geçersiz optimizasyon kaynak sınırı.");
  const deadline = Date.now() + maxMs;
  let remainingNodes = maxNodes;
  const trim = settings.startTrimMm + settings.endTrimMm;
  const trimKerf =
    kerf *
    ((settings.startTrimMm > 0 ? 1 : 0) + (settings.endTrimMm > 0 ? 1 : 0));
  const capacity = Math.round((stockMm - trim - trimKerf) * 1000);
  const groups = new Map<string, CutPiece[]>(),
    exclusions: CuttingExclusion[] = [];
  const ids = new Set<string>(),
    codes = new Set<string>();
  const spliceIds = new Set((plan.splices ?? []).map((s) => s.memberId));
  for (const m of plan.members) {
    if (!m || typeof m.id !== "string" || !m.id.trim() || ids.has(m.id))
      throw Error("Geçersiz veya mükerrer profil kimliği.");
    if (typeof m.code !== "string" || !m.code.trim() || codes.has(m.code))
      throw Error("Geçersiz veya mükerrer profil kodu.");
    ids.add(m.id);
    codes.add(m.code);
    const exclude = (reason: string, kind: CuttingExclusion["kind"]) =>
      exclusions.push({ memberId: m.id, code: m.code, reason, kind });
    const actual =
      m.start && m.end
        ? Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y)
        : NaN;
    if (
      !Number.isFinite(actual) ||
      actual <= 0 ||
      actual > 1e7 ||
      !Number.isFinite(m.lengthMm) ||
      Math.abs(actual - m.lengthMm) > 0.00001 ||
      !["upper", "lower", "perimeter"].includes(m.layer) ||
      typeof m.requiresSplice !== "boolean" ||
      m.productionReady !== false
    ) {
      exclude("Geçersiz veya tutarsız profil verisi/boyu.", "invalid");
      continue;
    }
    const sec = m.section;
    if (
      !sec ||
      !["steel", "aluminium"].includes(sec.material) ||
      ![sec.widthMm, sec.heightMm, sec.wallMm].every(
        (n) => Number.isFinite(n) && n > 0,
      ) ||
      sec.wallMm * 2 >= Math.min(sec.widthMm, sec.heightMm)
    ) {
      exclude("Profil kesiti geçersiz.", "invalid");
      continue;
    }
    if (
      m.requiresSplice ||
      spliceIds.has(m.id) ||
      Math.round((up(actual) + kerf) * 1000) > capacity
    ) {
      exclude(
        "Stok/uç kesim payı aşılıyor veya ek tasarımı gerekiyor; kendiliğinden bölünemez.",
        "splice",
      );
      continue;
    }
    if (
      plan.warnings?.some(
        (w) =>
          w.code === "STALE_SOURCE" ||
          (w.memberId === m.id &&
            [
              "MEMBER_OUTSIDE",
              "PROFILE_FOOTPRINT_UNPROVEN",
              "PROFILE_OVERLAP",
              "LAYER_ELEVATION_INVALID",
            ].includes(w.code)),
      )
    ) {
      exclude(
        "Karkas geometrisi doğrulanmadı; önce kaynak planı düzeltin.",
        "geometry",
      );
      continue;
    }
    const key = sectionKeyOf(m),
      list = groups.get(key) ?? [];
    list.push({
      memberId: m.id,
      code: m.code,
      layer: m.layer,
      actualLengthMm: actual,
      lengthMm: up(actual),
      sectionKey: key,
    });
    groups.set(key, list);
  }
  const stocks: CutStock[] = [],
    summaries: CuttingGroup[] = [];
  for (const [key, list] of [...groups.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const pieces = [...list].sort(
      (a, b) =>
        b.lengthMm - a.lengthMm ||
        a.code.localeCompare(b.code) ||
        a.memberId.localeCompare(b.memberId),
    );
    const packed = packStock(
      pieces.map((p) => Math.round((p.lengthMm + kerf) * 1000)),
      capacity,
      { nodes: remainingNodes, deadline },
    );
    remainingNodes -= packed.nodes;
    const bars = packed.bins.map((indices): CutStock => {
      const cuts = indices.map((i) => pieces[i]!);
      const kerfMm = cuts.length * kerf + trimKerf;
      const usedMm =
        (cuts.reduce((n, p) => n + Math.round(p.lengthMm * 1000), 0) +
          Math.round((trim + kerfMm) * 1000)) /
        1000;
      const remainderMm = Math.round((stockMm - usedMm) * 1000) / 1000;
      const reusableMm =
        remainderMm > 0 && remainderMm >= settings.minReusableMm
          ? remainderMm
          : 0;
      return {
        id: `S-${String(stocks.length + 1).padStart(3, "0")}`,
        sectionKey: key,
        stockLengthMm: stockMm,
        pieces: cuts,
        usedMm,
        remainderMm,
        kerfMm,
        trimMm: trim,
        reusableMm,
        wasteMm: kerfMm + trim + remainderMm - reusableMm,
      };
    });
    bars.forEach(
      (b, i) => (b.id = `S-${String(stocks.length + i + 1).padStart(3, "0")}`),
    );
    stocks.push(...bars);
    summaries.push({
      sectionKey: key,
      stockCount: bars.length,
      stockLowerBound: packed.optimal ? bars.length : packed.lowerBound,
      optimizationStatus: packed.optimal ? "optimal" : "feasible",
      searchNodes: packed.nodes,
      purchasedMm: bars.length * stockMm,
      pieceMm: pieces.reduce((n, p) => n + p.lengthMm, 0),
      kerfMm: bars.reduce((n, b) => n + b.kerfMm, 0),
      remainderMm: bars.reduce((n, b) => n + b.remainderMm, 0),
    });
  }
  const proven = summaries.every((g) => g.optimizationStatus === "optimal"),
    invalid = exclusions.some((e) => e.kind === "invalid");
  const optimizationStatus = invalid
    ? "invalid-input"
    : !stocks.length
      ? "not-computed"
      : proven
        ? "optimal"
        : "feasible";
  const lower = summaries.reduce((n, g) => n + g.stockLowerBound, 0);
  return {
    status: "estimate-only",
    validForFabrication: false,
    optimizationStatus,
    minimumStockCount: optimizationStatus === "optimal" ? stocks.length : null,
    stockLowerBound: lower,
    qualityRatio: lower > 0 ? stocks.length / lower : null,
    sourcePlanId: plan.id,
    sourcePlanUpdatedAt: plan.updatedAt,
    settings,
    stockLengthMm: stockMm,
    cutKerfMm: kerf,
    stocks,
    exclusions,
    groups: summaries,
    remnants: stocks
      .filter((b) => b.reusableMm > 0)
      .map((b) => ({
        stockId: b.id,
        sectionKey: b.sectionKey,
        lengthMm: b.reusableMm,
      })),
    allMembersIncluded: plan.members.length > 0 && exclusions.length === 0,
    totalPurchasedMm: stocks.length * stockMm,
    totalPieceMm: stocks
      .flatMap((b) => b.pieces)
      .reduce((n, p) => n + p.lengthMm, 0),
    totalKerfMm: stocks.reduce((n, b) => n + b.kerfMm, 0),
    totalTrimMm: stocks.length * trim,
    totalRemainderMm: stocks.reduce((n, b) => n + b.remainderMm, 0),
    totalReusableMm: stocks.reduce((n, b) => n + b.reusableMm, 0),
    totalWasteMm: stocks.reduce((n, b) => n + b.wasteMm, 0),
    warnings: [
      "Geometrik kesim planıdır; statik, bağlantı, mesnet ve imalat onayı değildir.",
      "Her parçaya (son parça dahil) bir ayırma kesimi; her sıfırdan büyük uç düzeltmesine ek bir kesim ayrılır. Fabrika ucundan kesimsiz parça kredisi verilmez.",
      "Boy, testere ve uç payları 0,001 mm yukarı; stok kapasitesi aşağı yuvarlanır. Optimalite bu üretim modeli ve dahil edilen profiller için stok adedine aittir; artık dağılımının optimum olduğu iddia edilmez.",
      ...(exclusions.length
        ? [
            `${exclusions.length} profil hariç. Hariç profiller satın alma hesabına dahil değildir.`,
          ]
        : []),
      ...(plan.warnings ?? []).map((w) => w.message),
    ],
  };
}

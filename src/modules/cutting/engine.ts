import type { FramingPlan, FramingMember } from "../framing/model";

/**
 * FAZ 03 — geometric cutting ESTIMATE, not an approved fabrication plan.
 * Kerf is charged once per output piece (conservative, assumes stock-end trimming).
 * Unresolved splices and invalid input never silently become purchasable pieces.
 */
export interface CutPiece {
  memberId: string;
  code: string;
  lengthMm: number;
  sectionKey: string;
}
export interface CutStock {
  id: string;
  sectionKey: string;
  stockLengthMm: number;
  pieces: CutPiece[];
  usedMm: number;
  remainderMm: number;
}
export interface CuttingExclusion {
  memberId: string;
  code: string;
  reason: string;
}
export interface CuttingGroup {
  sectionKey: string;
  stockCount: number;
  purchasedMm: number;
  pieceMm: number;
  kerfMm: number;
  remainderMm: number;
}
export interface CuttingEstimate {
  status: "estimate-only";
  validForFabrication: false;
  sourcePlanId: string;
  sourcePlanUpdatedAt: string;
  stockLengthMm: number;
  cutKerfMm: number;
  stocks: CutStock[];
  exclusions: CuttingExclusion[];
  groups: CuttingGroup[];
  allMembersIncluded: boolean;
  totalPurchasedMm: number;
  totalPieceMm: number;
  totalKerfMm: number;
  totalRemainderMm: number;
  warnings: string[];
}
const tolerance = 0.00001;
export const sectionKeyOf = (m: FramingMember): string =>
  [m.section.material, m.section.widthMm, m.section.heightMm, m.section.wallMm].join("|");

function validateLength(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0 || value > 1e9)
    throw new Error(`Geçersiz ${label}.`);
}
/** Conservative kerf model: one full kerf for every piece removed from the bar. */
function placeGroup(pieces: CutPiece[], stockMm: number, kerfMm: number): CutStock[] {
  const ordered = [...pieces].sort((a, b) =>
    b.lengthMm - a.lengthMm || a.code.localeCompare(b.code) || a.memberId.localeCompare(b.memberId),
  );
  const stocks: CutStock[] = [];
  for (const piece of ordered) {
    const need = piece.lengthMm + kerfMm;
    let best = -1, leastLeft = Infinity;
    for (let j = 0; j < stocks.length; j++) {
      const remain = stocks[j]!.remainderMm - need;
      if (remain >= -tolerance && remain < leastLeft) {
        leastLeft = remain;
        best = j;
      }
    }
    if (best < 0) {
      stocks.push({
        id: `S-${stocks.length + 1}`,
        sectionKey: piece.sectionKey,
        stockLengthMm: stockMm,
        pieces: [],
        usedMm: 0,
        remainderMm: stockMm,
      });
      best = stocks.length - 1;
    }
    const stock = stocks[best]!;
    stock.pieces.push(piece);
    stock.usedMm += need;
    stock.remainderMm = Math.max(0, stockMm - stock.usedMm);
  }
  return stocks;
}
export function estimateCutting(plan: FramingPlan): CuttingEstimate {
  if (plan.version !== 1 || plan.technicalStatus !== "requires-approval")
    throw new Error("Karkas planı sürümü veya teknik durumu geçersiz.");
  const stockMm = plan.settings.stockLengthMm, kerfMm = plan.settings.kerfMm;
  validateLength(stockMm, "stok boyu");
  if (!Number.isFinite(kerfMm) || kerfMm < 0 || kerfMm >= stockMm)
    throw new Error("Geçersiz testere payı.");
  const groups = new Map<string, CutPiece[]>();
  const exclusions: CuttingExclusion[] = [];
  const seen = new Set<string>();
  for (const m of plan.members) {
    if (seen.has(m.id)) throw new Error("Mükerrer profil kimliği.");
    seen.add(m.id);
    const actual = Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y);
    const invalid = !Number.isFinite(actual) || actual <= 0 ||
      !Number.isFinite(m.lengthMm) || Math.abs(actual - m.lengthMm) > tolerance;
    const key = sectionKeyOf(m);
    if (invalid) {
      exclusions.push({ memberId: m.id, code: m.code, reason: "Geçersiz veya tutarsız boy." });
      continue;
    }
    if (m.requiresSplice || m.lengthMm + kerfMm > stockMm + tolerance) {
      exclusions.push({
        memberId: m.id, code: m.code,
        reason: "Stok boyu aşılıyor veya ek tasarımı gerekiyor; kendiliğinden bölünemez.",
      });
      continue;
    }
    if (!["steel", "aluminium"].includes(m.section.material) ||
      [m.section.widthMm, m.section.heightMm, m.section.wallMm].some(n => !Number.isFinite(n) || n <= 0)) {
      exclusions.push({ memberId: m.id, code: m.code, reason: "Profil kesiti geçersiz." });
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push({ memberId: m.id, code: m.code, lengthMm: m.lengthMm, sectionKey: key });
    groups.set(key, list);
  }
  const stocks: CutStock[] = [];
  const summaries: CuttingGroup[] = [];
  for (const [key, pieces] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const bars = placeGroup(pieces, stockMm, kerfMm);
    bars.forEach((bar, idx) => { bar.id = `${key}:S-${idx + 1}`; });
    stocks.push(...bars);
    summaries.push({
      sectionKey: key,
      stockCount: bars.length,
      purchasedMm: bars.length * stockMm,
      pieceMm: pieces.reduce((n, p) => n + p.lengthMm, 0),
      kerfMm: pieces.length * kerfMm,
      remainderMm: bars.reduce((n, s) => n + s.remainderMm, 0),
    });
  }
  const totalPurchasedMm = summaries.reduce((n, s) => n + s.purchasedMm, 0);
  const totalPieceMm = summaries.reduce((n, s) => n + s.pieceMm, 0);
  const totalKerfMm = summaries.reduce((n, s) => n + s.kerfMm, 0);
  const totalRemainderMm = summaries.reduce((n, s) => n + s.remainderMm, 0);
  const warnings = ["Geometrik kesim tahminidir; statik, ek yeri ve imalat onayı değildir.",
    "Her parçaya bir kesim payı ayrıldı. Gerçek makine/uç düzeltme payını kontrol edin."];
  if (exclusions.length) warnings.push(`${exclusions.length} profil stok kesim hesabından hariç; ek tasarımı veya düzeltme gerekli.`);
  if (plan.warnings.some(w => w.code !== "TECHNICAL_APPROVAL_REQUIRED"))
    warnings.push("Karkas planında çözülmemiş teknik/geometrik uyarılar var.");
  return {
    status: "estimate-only", validForFabrication: false,
    sourcePlanId: plan.id, sourcePlanUpdatedAt: plan.updatedAt,
    stockLengthMm: stockMm, cutKerfMm: kerfMm, stocks, exclusions, groups: summaries,
    allMembersIncluded: exclusions.length === 0,
    totalPurchasedMm, totalPieceMm, totalKerfMm, totalRemainderMm,
    warnings,
  };
}

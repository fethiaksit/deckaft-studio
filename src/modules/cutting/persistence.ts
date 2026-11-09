import type { FramingPlan } from "../framing/model";
import { parseFraming } from "../framing/persistence";
import { estimateCutting } from "./engine";
import {
  framingRevision,
  type CuttingOptions,
  type CuttingPlan,
} from "./model";
export function createCuttingPlan(
  source: FramingPlan,
  options: CuttingOptions,
  meta: { id: string; now: string },
): CuttingPlan {
  return parseCutting(
    JSON.stringify({
      ...estimateCutting(source, options),
      version: 1,
      id: meta.id,
      projectId: source.projectId,
      sourceRevision: framingRevision(source),
      createdAt: meta.now,
      stale: false,
    }),
  );
}
const fail = (): never => {
  throw Error("Kesim kaydı geçersiz veya tutarsız.");
};
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const close = (a: number, b: number) =>
  Number.isFinite(a) && Math.abs(a - b) < 0.000001;
export function parseCutting(json: string): CuttingPlan {
  const p = JSON.parse(json) as CuttingPlan;
  if (
    !p ||
    p.version !== 1 ||
    typeof p.id !== "string" ||
    !p.id ||
    typeof p.projectId !== "string" ||
    !p.projectId ||
    !Number.isFinite(Date.parse(p.createdAt)) ||
    p.stale !== false ||
    p.status !== "estimate-only" ||
    p.validForFabrication !== false ||
    !p.settings ||
    p.settings.cutRule !== "per-piece-and-trim" ||
    p.settings.resolutionMm !== 0.001
  )
    fail();
  const source = parseFraming(p.sourceRevision);
  if (
    source.projectId !== p.projectId ||
    source.id !== p.sourcePlanId ||
    source.updatedAt !== p.sourcePlanUpdatedAt
  )
    fail();
  const reference = estimateCutting(source, {
    ...p.settings,
    maxSearchNodes: 0,
    maxSearchMs: 0,
  });
  if (
    !same(reference.settings, p.settings) ||
    !same(reference.exclusions, p.exclusions) ||
    !Array.isArray(p.stocks) ||
    !Array.isArray(p.groups) ||
    !Array.isArray(p.remnants) ||
    !same(reference.warnings, p.warnings) ||
    p.allMembersIncluded !== reference.allMembersIncluded ||
    p.stockLengthMm !== p.settings.stockLengthMm ||
    p.cutKerfMm !== p.settings.cutKerfMm
  )
    fail();
  const expected = new Map(
    reference.stocks.flatMap((s) => s.pieces).map((c) => [c.memberId, c]),
  );
  const stockIds = new Set<string>();
  const trim = p.settings.startTrimMm + p.settings.endTrimMm;
  const trimCuts =
    (p.settings.startTrimMm > 0 ? 1 : 0) + (p.settings.endTrimMm > 0 ? 1 : 0);
  for (const b of p.stocks) {
    if (
      !b ||
      typeof b.id !== "string" ||
      !b.id ||
      stockIds.has(b.id) ||
      b.stockLengthMm !== p.stockLengthMm ||
      !Array.isArray(b.pieces) ||
      !b.pieces.length
    )
      fail();
    stockIds.add(b.id);
    let pieceMm = 0;
    for (const c of b.pieces) {
      if (
        !c ||
        !same(expected.get(c.memberId), c) ||
        c.sectionKey !== b.sectionKey
      )
        fail();
      expected.delete(c.memberId);
      pieceMm += c.lengthMm;
    }
    const kerf = (b.pieces.length + trimCuts) * p.cutKerfMm,
      used = pieceMm + trim + kerf;
    const remainder = p.stockLengthMm - used,
      reusable =
        remainder > 0 && remainder >= p.settings.minReusableMm ? remainder : 0;
    if (
      remainder < -0.000001 ||
      !close(b.kerfMm, kerf) ||
      !close(b.trimMm, trim) ||
      !close(b.usedMm, used) ||
      !close(b.remainderMm, remainder) ||
      !close(b.reusableMm, reusable) ||
      !close(b.wasteMm, kerf + trim + remainder - reusable)
    )
      fail();
  }
  if (expected.size) fail();
  const sum = (
    key:
      "usedMm" | "kerfMm" | "trimMm" | "remainderMm" | "reusableMm" | "wasteMm",
  ) => p.stocks.reduce((n, b) => n + b[key], 0);
  if (
    !close(p.totalPurchasedMm, p.stocks.length * p.stockLengthMm) ||
    !close(p.totalPieceMm, reference.totalPieceMm) ||
    !close(p.totalKerfMm, sum("kerfMm")) ||
    !close(p.totalTrimMm, sum("trimMm")) ||
    !close(p.totalRemainderMm, sum("remainderMm")) ||
    !close(p.totalReusableMm, sum("reusableMm")) ||
    !close(p.totalWasteMm, sum("wasteMm")) ||
    !close(
      p.totalPurchasedMm,
      p.totalPieceMm + p.totalWasteMm + p.totalReusableMm,
    )
  )
    fail();
  if (
    !same(
      p.remnants,
      p.stocks
        .filter((b) => b.reusableMm > 0)
        .map((b) => ({
          stockId: b.id,
          sectionKey: b.sectionKey,
          lengthMm: b.reusableMm,
        })),
    )
  )
    fail();
  if (p.groups.length !== reference.groups.length) fail();
  const replay = estimateCutting(source, {
    ...p.settings,
    maxSearchNodes: 250000,
    maxSearchMs: 150,
  });
  const keys = new Set<string>();
  for (const g of p.groups) {
    const ref = reference.groups.find((q) => q.sectionKey === g.sectionKey),
      bars = p.stocks.filter((b) => b.sectionKey === g.sectionKey);
    if (
      !ref ||
      keys.has(g.sectionKey) ||
      !bars.length ||
      g.stockCount !== bars.length ||
      !Number.isSafeInteger(g.stockLowerBound) ||
      g.stockLowerBound < ref.stockLowerBound ||
      g.stockLowerBound > g.stockCount ||
      !Number.isSafeInteger(g.searchNodes) ||
      g.searchNodes < 0 ||
      !["optimal", "feasible"].includes(g.optimizationStatus) ||
      (g.optimizationStatus === "optimal" &&
        g.stockLowerBound !== g.stockCount) ||
      !close(g.purchasedMm, bars.length * p.stockLengthMm) ||
      !close(g.pieceMm, ref.pieceMm) ||
      !close(
        g.kerfMm,
        bars.reduce((n, b) => n + b.kerfMm, 0),
      ) ||
      !close(
        g.remainderMm,
        bars.reduce((n, b) => n + b.remainderMm, 0),
      )
    )
      fail();
    // Internal totals are not an optimality certificate. Replay the bounded
    // solver independently of saved bounds; reject claims disproved by replay.
    const verified = replay.groups.find((q) => q.sectionKey === g.sectionKey)!;
    if (g.stockLowerBound > verified.stockCount) fail();
    if (
      verified.optimizationStatus === "optimal" &&
      (g.stockLowerBound > verified.stockCount ||
        (g.optimizationStatus === "optimal" &&
          g.stockCount !== verified.stockCount))
    )
      fail();
    keys.add(g.sectionKey);
  }
  const status =
    reference.optimizationStatus === "invalid-input"
      ? "invalid-input"
      : !p.stocks.length
        ? "not-computed"
        : p.groups.every((g) => g.optimizationStatus === "optimal")
          ? "optimal"
          : "feasible";
  const lower = p.groups.reduce((n, g) => n + g.stockLowerBound, 0);
  if (
    p.optimizationStatus !== status ||
    p.stockLowerBound !== lower ||
    p.minimumStockCount !== (status === "optimal" ? p.stocks.length : null) ||
    p.qualityRatio !== (lower > 0 ? p.stocks.length / lower : null)
  )
    fail();
  // A slower device may not replay a previously completed search within its
  // budget. Retain the feasible assignment but never trust an unverified bound.
  const groups = p.groups.map((g) => {
    const ref = replay.groups.find((r) => r.sectionKey === g.sectionKey)!;
    return {
      ...g,
      optimizationStatus:
        g.optimizationStatus === "optimal" &&
        ref.optimizationStatus !== "optimal"
          ? ("feasible" as const)
          : g.optimizationStatus,
      stockLowerBound: Math.min(g.stockLowerBound, ref.stockLowerBound),
    };
  });
  const verifiedStatus =
    status === "optimal" &&
    groups.some((g) => g.optimizationStatus !== "optimal")
      ? "feasible"
      : status;
  const verifiedLower = groups.reduce((n, g) => n + g.stockLowerBound, 0);
  return {
    ...p,
    groups,
    optimizationStatus: verifiedStatus,
    minimumStockCount: verifiedStatus === "optimal" ? p.stocks.length : null,
    stockLowerBound: verifiedLower,
    qualityRatio: verifiedLower > 0 ? p.stocks.length / verifiedLower : null,
  };
}

import { FRAMING } from "./config";
import type { DrawingDocument } from "../drawing/model";
import type { FramingPlan, FramingSettings, FramingWarning } from "./model";
import {
  segmentIntersection,
  pointOnSegment,
  clipSegment,
  containsSegment,
  EPS,
  uv,
} from "./geometry";
export const geometrySignature = (d: DrawingDocument) =>
  JSON.stringify(
    d.paths
      .filter((p) => p.role === "outer" || p.role === "void")
      .map((p) => ({
        role: p.role,
        closed: p.closed,
        points: p.points.map((q) => [q.x, q.y]),
      })),
  );
export function validateSettings(s: FramingSettings): void {
  if (!s || typeof s !== "object") throw Error("Karkas ayarları okunamadı.");
  if (!Number.isFinite(s.kerfMm) || s.kerfMm < 0)
    throw Error("Testere payı sıfır veya pozitif bir mm değeri olmalı.");
  if (
    s.unit !== "mm" ||
    s.system !== "two-layer" ||
    !["horizontal", "vertical"].includes(s.deckDirection) ||
    typeof s.doubleJointSupport !== "boolean"
  )
    throw Error("Invalid framing system");
  for (const key of [
    "deckLengthMm",
    "stockLengthMm",
    "upperMaxSpacingMm",
  ] as const)
    if (!Number.isFinite(s[key]) || s[key] <= 0) throw Error(`Invalid ${key}`);
  for (const key of [
    "kerfMm",
    "boardWidthMm",
    "boardGapMm",
    "edgeGapMm",
    "jointGapMm",
    "installationGapMm",
    "lowerSpacingMm",
    "supportSpacingMm",
    "designLoadKnM2",
    "allowableSpanMm",
  ] as const) {
    const n = s[key];
    if (
      n !== null &&
      (!Number.isFinite(n) ||
        n < 0 ||
        ([
          "boardWidthMm",
          "lowerSpacingMm",
          "supportSpacingMm",
          "allowableSpanMm",
        ].includes(key) &&
          n === 0))
    )
      throw Error(`Invalid ${key}`);
  }
  for (const sec of [s.upperSection, s.lowerSection, s.perimeterSection])
    if (
      !sec ||
      ![sec.widthMm, sec.heightMm, sec.wallMm].every(
        (n) => Number.isFinite(n) && n > 0,
      ) ||
      sec.wallMm * 2 >= Math.min(sec.widthMm, sec.heightMm) ||
      !["steel", "aluminium"].includes(sec.material)
    )
      throw Error("Invalid profile section");
}
export function validateFraming(
  p: FramingPlan,
  d: DrawingDocument,
): FramingWarning[] {
  const upperCount = p.members.filter((m) => m.layer === "upper").length,
    lowerCount = p.members.filter((m) => m.layer === "lower").length;
  if (
    p.members.length > FRAMING.maxMembers ||
    p.connections.length > FRAMING.maxPieces ||
    upperCount * lowerCount > FRAMING.maxPieces ||
    (upperCount * (upperCount - 1)) / 2 > FRAMING.maxPieces
  )
    throw Error(
      "Karkas eşleşme hesap sınırı aşıldı; profil aralıklarını artırın.",
    );
  const warnings: FramingWarning[] = [];
  const add = (
    code: string,
    message: string,
    memberId?: string,
    pieceId?: string,
  ) =>
    warnings.push({
      code,
      message,
      ...(memberId ? { memberId } : {}),
      ...(pieceId ? { pieceId } : {}),
    });
  add(
    "TECHNICAL_APPROVAL_REQUIRED",
    "Ön yerleşim; yük, açıklık, bağlantı ve mesnet statik onayı yapılmadı.",
  );
  if (p.sourceGeometry !== geometrySignature(d))
    add("STALE_SOURCE", "Alan değişti; karkas yeniden oluşturulmalıdır.");
  if (p.settings.lowerSpacingMm === null)
    add("LOWER_SPACING_REQUIRED", "Alt karkas aralığı belirtilmedi.");
  if (p.settings.supportSpacingMm === null)
    add("SUPPORT_SPACING_REQUIRED", "Ayak/mesnet aralığı belirtilmedi.");
  if (
    [
      p.settings.boardWidthMm,
      p.settings.boardGapMm,
      p.settings.edgeGapMm,
      p.settings.jointGapMm,
      p.settings.installationGapMm,
    ].some((n) => n === null)
  )
    add(
      "DECK_LAYOUT_INCOMPLETE",
      "Tahta genişliği ve tüm boşluklar olmadan gerçek sıra/ek hesaplanamaz.",
    );
  if (
    p.joints.length &&
    (p.settings.jointGapMm ?? 0) < (p.settings.installationGapMm ?? 0)
  )
    add(
      "JOINT_CLEARANCE_INCOMPATIBLE",
      "Ek destek yüzleri arası derz, gerekli montaj boşluğundan küçük.",
    );
  if (
    [
      p.settings.boardWidthMm,
      p.settings.boardGapMm,
      p.settings.edgeGapMm,
      p.settings.jointGapMm,
      p.settings.installationGapMm,
    ].every((value) => value !== null) &&
    !p.rows.length
  )
    add(
      "DECK_LAYOUT_EMPTY",
      "Girilen tahta genişliği veya kenar boşluklarıyla sıra oluşturulamadı; deck uç destekleri doğrulanmadı.",
    );
  const vertical = p.settings.deckDirection === "vertical";
  const upp = p.members.filter((m) => m.layer === "upper");
  const diagonalUpper = upp.filter(
    (m) => Math.abs(uv(m.start, vertical).x - uv(m.end, vertical).x) > EPS,
  );
  for (const m of diagonalUpper)
    add(
      "UPPER_ORIENTATION_UNPROVEN",
      "Eğik üst profil için deck dik desteği doğrulanamadı.",
      m.id,
    );
  if (diagonalUpper.length)
    add(
      "UPPER_SPACING_UNPROVEN",
      "Eğik üst profiller aks aralığı kanıtına dahil edilmedi.",
    );

  if (p.rows.length) {
    const outer = d.paths.find((q) => q.role === "outer"),
      bounds = outer?.points.map((pt) => uv(pt, vertical)) ?? [];
    const irregular =
      !outer ||
      outer.points.length !== 4 ||
      outer.points.some((a, i) => {
        const b = outer.points[(i + 1) % outer.points.length]!;
        return a.x !== b.x && a.y !== b.y;
      }) ||
      d.paths.some((q) => q.role === "void");
    const maxY = Math.max(...bounds.map((q) => q.y)),
      lastY = Math.max(
        ...p.rows.map((r) => uv(r.start, vertical).y + r.widthMm / 2),
      );
    if (irregular || lastY < maxY - (p.settings.edgeGapMm ?? 0) - EPS)
      add(
        "DECK_COVERAGE_INCOMPLETE",
        "Sıralar yalnız kanıtlanan tam genişlikli dikdörtgenleri kapsar; sınır kamaları veya kalan sıra genişliği için özel döşeme gerekir.",
      );
  }

  if (!p.settings.doubleJointSupport && p.joints.length)
    add(
      "DOUBLE_SUPPORT_DISABLED",
      "Deck eklerinde çift destek kapalı; ek uçları doğrulanmadı.",
    );
  for (const m of p.members) {
    const dx = m.end.x - m.start.x,
      dy = m.end.y - m.start.y,
      len = Math.hypot(dx, dy);
    if (len > EPS) {
      const ox = ((-dy / len) * m.section.widthMm) / 2,
        oy = ((dx / len) * m.section.widthMm) / 2;
      if (
        ![-1, 1].every((k) =>
          containsSegment(
            d,
            { x: m.start.x + k * ox, y: m.start.y + k * oy },
            { x: m.end.x + k * ox, y: m.end.y + k * oy },
          ),
        )
      )
        add(
          "PROFILE_FOOTPRINT_UNPROVEN",
          "Profil genişliğinin alan içinde kaldığı doğrulanamadı.",
          m.id,
        );
    }

    if (
      m.zBottomMm !==
      (m.layer === "lower" ? 0 : p.settings.lowerSection.heightMm)
    )
      add("LAYER_ELEVATION_INVALID", "Katman kotu geçersiz.", m.id);
    if (!containsSegment(d, m.start, m.end))
      add("MEMBER_OUTSIDE", "Profil kullanılabilir alan dışında.", m.id);
    if (m.lengthMm > p.settings.stockLengthMm + EPS)
      add("STOCK_EXCEEDED", "Stok boyu aşıldı; ek tasarımı gerekli.", m.id);
    if (
      m.layer === "upper" &&
      !p.members.some((b) => {
        if (
          b.layer !== "lower" ||
          Math.abs(m.zBottomMm - b.zBottomMm - b.section.heightMm) > EPS
        )
          return false;
        return segmentIntersection(m.start, m.end, b.start, b.end) !== null;
      })
    )
      add(
        "LOWER_CONTACT_MISSING",
        "Üst profil için alt karkas teması yok.",
        m.id,
      );
  }
  for (const foot of p.supports) {
    const m = p.members.find((m) => m.id === foot.memberId);
    if (!m || m.layer !== "lower" || !pointOnSegment(foot.at, m.start, m.end))
      add(
        "SUPPORT_CONTACT_MISSING",
        "Mesnet alt profil üzerinde değil.",
        foot.memberId ?? undefined,
      );
  }
  if (p.settings.supportSpacingMm !== null)
    for (const m of p.members.filter((m) => m.layer === "lower")) {
      const l = Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y);
      const positions = p.supports
        .filter(
          (q) => q.memberId === m.id && pointOnSegment(q.at, m.start, m.end),
        )
        .map((q) => Math.hypot(q.at.x - m.start.x, q.at.y - m.start.y))
        .sort((a, b) => a - b);
      if (
        !positions.length ||
        [0, ...positions, l].some(
          (x, i, a) =>
            i > 0 && x - a[i - 1]! > p.settings.supportSpacingMm! + EPS,
        )
      )
        add(
          "SUPPORT_SPACING_EXCEEDED",
          "Alt profil mesnet aralığı sınırı aşıldı.",
          m.id,
        );
    }
  for (const piece of p.pieces)
    for (const end of ["start", "end"] as const) {
      const id = piece[end === "start" ? "startSupportId" : "endSupportId"],
        m = upp.find((m) => m.id === id),
        pt = uv(piece[end], vertical);
      let valid = piece.lengthMm + EPS >= 2 * p.settings.upperSection.widthMm;
      const feasible = valid;
      valid = false;
      if (m) {
        const a = uv(m.start, vertical),
          b = uv(m.end, vertical),
          half = m.section.widthMm / 2;
        const face = end === "start" ? a.x - half : a.x + half;
        valid =
          feasible &&
          Math.abs(a.x - b.x) <= EPS &&
          Math.abs(face - pt.x) <= EPS &&
          Math.min(a.y, b.y) <= pt.y - piece.widthMm / 2 + EPS &&
          Math.max(a.y, b.y) >= pt.y + piece.widthMm / 2 - EPS;
      }
      if (!valid)
        add(
          "DECK_END_UNSUPPORTED",
          "Deck ucunun tam genişlikte destek yüzeyi doğrulanamadı.",
          undefined,
          piece.id,
        );
    }
  // Sample every geometry/member endpoint slab, so deleted or shortened supports cannot hide behind global axes.
  const ys = [
    ...new Set([
      ...d.paths.flatMap((q) => q.points.map((pt) => uv(pt, vertical).y)),
      ...upp.flatMap((m) => [uv(m.start, vertical).y, uv(m.end, vertical).y]),
    ]),
  ].sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) {
    const y = (ys[i - 1]! + ys[i]!) / 2;
    const xs = upp
      .filter((m) => {
        const a = uv(m.start, vertical),
          b = uv(m.end, vertical);
        return (
          Math.abs(a.x - b.x) <= EPS &&
          Math.min(a.y, b.y) <= y &&
          Math.max(a.y, b.y) >= y
        );
      })
      .map((m) => uv(m.start, vertical).x)
      .sort((a, b) => a - b);
    const all = d.paths
      .filter((q) => q.role === "outer")
      .flatMap((q) => q.points.map((pt) => uv(pt, vertical).x));
    const clips = clipSegment(
      d,
      uv({ x: Math.min(...all), y }, vertical),
      uv({ x: Math.max(...all), y }, vertical),
    );
    if (
      clips.some((c) => {
        const a = uv(c.start, vertical).x,
          b = uv(c.end, vertical).x,
          axes = xs.filter((x) => x >= a - EPS && x <= b + EPS);
        return (
          !axes.length ||
          [a, ...axes, b].some(
            (x, k, arr) =>
              k > 0 && x - arr[k - 1]! > p.settings.upperMaxSpacingMm + EPS,
          )
        );
      })
    ) {
      add("UPPER_SPACING_EXCEEDED", "Üst profil aks aralığı sınırı aşıldı.");
      break;
    }
  }
  const sortedUpper = [...upp].sort(
    (a, b) => uv(a.start, vertical).x - uv(b.start, vertical).x,
  );
  const maxSectionWidth = Math.max(
    p.settings.upperSection.widthMm,
    ...upp.map((m) => m.section.widthMm),
  );
  for (let i = 0; i < sortedUpper.length; i++)
    for (let j = i + 1; j < sortedUpper.length; j++) {
      const a = uv(sortedUpper[i]!.start, vertical),
        b = uv(sortedUpper[i]!.end, vertical),
        c = uv(sortedUpper[j]!.start, vertical),
        e = uv(sortedUpper[j]!.end, vertical);
      if (c.x - a.x >= maxSectionWidth) break;
      if (
        Math.abs(a.x - c.x) <
          (sortedUpper[i]!.section.widthMm + sortedUpper[j]!.section.widthMm) /
            2 -
            EPS &&
        Math.min(Math.max(a.y, b.y), Math.max(c.y, e.y)) -
          Math.max(Math.min(a.y, b.y), Math.min(c.y, e.y)) >
          EPS
      )
        add(
          "PROFILE_OVERLAP",
          "Aynı katman profil kesitleri çakışıyor.",
          sortedUpper[j]!.id,
        );
    }
  return warnings;
}

import type { DrawingDocument } from "../drawing/model";
import type { PointMm } from "../geometry/model";
import { areaReport, validateRing } from "../geometry/engine";
import { validPoint } from "../drawing/model";
import { DRAWING } from "../drawing/config";
import { FRAMING } from "./config";
import {
  segmentIntersection,
  clipSegment,
  distance,
  EPS,
  uv,
} from "./geometry";
import {
  geometrySignature,
  validateFraming,
  validateSettings,
} from "./validation";
import type {
  FramingPlan,
  FramingSettings,
  FramingTotals,
  FramingMember,
} from "./model";
export const sourceGeometrySignature = geometrySignature;
export function generateFraming(
  doc: DrawingDocument,
  settings: FramingSettings,
  meta: { id: string; projectId: string; now: string },
): FramingPlan {
  validateSettings(settings);
  if (
    doc.paths.length > DRAWING.maxPaths ||
    doc.paths.reduce((n, q) => n + q.points.length, 0) > DRAWING.maxPoints
  )
    throw Error("Çizim kaynak sınırı aşıldı.");
  const paths = doc.paths.filter(
    (p) => p.role === "outer" || p.role === "void",
  );
  if (
    paths.filter((p) => p.role === "outer").length !== 1 ||
    paths.some(
      (p) =>
        p.points.some((q) => !validPoint(q)) ||
        validateRing({ points: p.points, closed: p.closed }).length,
    )
  )
    throw Error("Geçerli kapalı dış alan ve boşluklar gerekli.");
  const report = areaReport(
    paths.find((q) => q.role === "outer")
      ? { points: paths.find((q) => q.role === "outer")!.points, closed: true }
      : null,
    paths
      .filter((q) => q.role === "void")
      .map((q) => ({ points: q.points, closed: q.closed })),
  );
  if (!report.valid || !report.netM2 || report.netM2 <= 0)
    throw Error("Geçersiz dış alan/boşluk geometrisi.");
  const s = JSON.parse(JSON.stringify(settings)) as FramingSettings,
    v = s.deckDirection === "vertical",
    to = (p: PointMm) => uv(p, v),
    pts = paths.find((p) => p.role === "outer")!.points.map(to),
    minX = Math.min(...pts.map((p) => p.x)),
    maxX = Math.max(...pts.map((p) => p.x)),
    minY = Math.min(...pts.map((p) => p.y)),
    maxY = Math.max(...pts.map((p) => p.y));
  const p: FramingPlan = {
    version: 1,
    ...meta,
    createdAt: meta.now,
    updatedAt: meta.now,
    sourceGeometry: sourceGeometrySignature(doc),
    settings: s,
    members: [],
    rows: [],
    pieces: [],
    joints: [],
    connections: [],
    supports: [],
    splices: [],
    manualChanges: [],
    technicalStatus: "requires-approval",
    warnings: [],
  };
  const add = (
    layer: FramingMember["layer"],
    role: FramingMember["role"],
    a: PointMm,
    b: PointMm,
  ) => {
    if (distance(a, b) < EPS) return null;
    const existing = p.members.find(
      (m) =>
        m.layer === layer &&
        ((distance(m.start, a) < EPS && distance(m.end, b) < EPS) ||
          (distance(m.start, b) < EPS && distance(m.end, a) < EPS)),
    );
    if (existing) return existing.id;
    if (p.members.length >= FRAMING.maxMembers)
      throw Error("Profil sayısı sınırı aşıldı.");
    const count = p.members.filter((m) => m.layer === layer).length + 1,
      code = `${layer === "upper" ? "U" : layer === "lower" ? "L" : "P"}-${String(count).padStart(3, "0")}`,
      id = `${p.id}-${code}`;
    p.members.push({
      id,
      code,
      layer,
      role,
      start: a,
      end: b,
      lengthMm: distance(a, b),
      zBottomMm: layer === "lower" ? 0 : s.lowerSection.heightMm,
      section: {
        ...(layer === "upper"
          ? s.upperSection
          : layer === "lower"
            ? s.lowerSection
            : s.perimeterSection),
      },
      connectionIds: [],
      method: "automatic",
      requiresSplice: false,
      productionReady: false,
    });
    return id;
  };
  const line = (x: number, role: FramingMember["role"]) => {
    for (const c of clipSegment(doc, to({ x, y: minY }), to({ x, y: maxY })))
      add("upper", role, c.start, c.end);
  };
  // The board footprint is proven over every vertex-delimited strip, not a centre-line guess.
  if (
    [
      s.boardWidthMm,
      s.boardGapMm,
      s.edgeGapMm,
      s.jointGapMm,
      s.installationGapMm,
    ].every((n) => n !== null)
  ) {
    const width = s.boardWidthMm!,
      gap = s.boardGapMm!,
      edge = s.edgeGapMm!;
    const rowCount = Math.floor((maxY - minY - 2 * edge + gap) / (width + gap));
    if (rowCount > FRAMING.maxRows) throw Error("Deck sıra sınırı aşıldı.");
    for (let r = 0; r < rowCount; r++) {
      const y0 = minY + edge + r * (width + gap),
        y1 = y0 + width,
        ys = [
          y0,
          y1,
          ...paths.flatMap((q) =>
            q.points
              .map(to)
              .map((q) => q.y)
              .filter((y) => y > y0 && y < y1),
          ),
        ].sort((a, b) => a - b);
      const samples = [...ys, ...ys.slice(1).map((y, i) => (y + ys[i]!) / 2)];
      let intervals = [{ a: minX, b: maxX }];
      for (const y of samples) {
        const clips = clipSegment(
          doc,
          to({ x: minX, y }),
          to({ x: maxX, y }),
        ).map((c) => ({ a: to(c.start).x, b: to(c.end).x }));
        intervals = intervals.flatMap((a) =>
          clips
            .map((b) => ({ a: Math.max(a.a, b.a), b: Math.min(a.b, b.b) }))
            .filter((q) => q.b - q.a > EPS),
        );
      }
      for (const interval of intervals) {
        const a = interval.a + edge,
          b = interval.b - edge;
        if (b - a < EPS) continue;
        const rowId = `${p.id}-R-${p.rows.length + 1}`,
          y = (y0 + y1) / 2,
          row = {
            id: rowId,
            start: to({ x: a, y }),
            end: to({ x: b, y }),
            widthMm: width,
            pieceIds: [] as string[],
          };
        p.rows.push(row);
        let x = a,
          previous: string | null = null;
        while (x < b - EPS) {
          if (p.pieces.length >= FRAMING.maxPieces)
            throw Error("Deck parça sınırı aşıldı.");
          const end = Math.min(x + s.deckLengthMm, b),
            id = `${p.id}-D-${p.pieces.length + 1}`;
          const support = (pos: number, start: boolean) => {
            if (
              !s.doubleJointSupport &&
              ((start && previous) || (!start && end < b))
            )
              return null;
            const cx = pos + (start ? 1 : -1) * (s.upperSection.widthMm / 2);
            line(
              cx,
              (previous && start) || (end < b && !start)
                ? "jointSupport"
                : "endSupport",
            );
            return (
              p.members.find(
                (m) =>
                  m.layer === "upper" &&
                  Math.abs(to(m.start).x - cx) < EPS &&
                  Math.min(to(m.start).y, to(m.end).y) <= y0 + EPS &&
                  Math.max(to(m.start).y, to(m.end).y) >= y1 - EPS,
              )?.id ?? null
            );
          };
          const startSupportId = support(x, true),
            endSupportId = support(end, false);
          p.pieces.push({
            id,
            rowId,
            start: to({ x, y }),
            end: to({ x: end, y }),
            widthMm: width,
            lengthMm: end - x,
            startSupportId,
            endSupportId,
          });
          row.pieceIds.push(id);
          if (previous) {
            const left = p.pieces.find((q) => q.id === previous)!;
            p.joints.push({
              id: `${p.id}-J-${p.joints.length + 1}`,
              rowId,
              leftPieceId: previous,
              rightPieceId: id,
              at: to({ x: (to(left.end).x + x) / 2, y }),
              supportIds: [left.endSupportId, startSupportId].filter(
                (q): q is string => q !== null,
              ),
              verified: false,
            });
          }
          previous = id;
          if (end >= b - EPS) break;
          x = end + s.jointGapMm!;
        }
      }
    }
  }
  // Fill the remaining axes after endpoint and seam supports so regular axes cannot duplicate them.
  const required = [
    ...new Set([
      minX,
      maxX,
      ...p.members.filter((m) => m.layer === "upper").map((m) => to(m.start).x),
    ]),
  ].sort((a, b) => a - b);
  if ((maxX - minX) / s.upperMaxSpacingMm > FRAMING.maxMembers)
    throw Error("Profil sayısı sınırı aşıldı.");
  for (let i = 1; i < required.length; i++) {
    const a = required[i - 1]!,
      b = required[i]!,
      n = Math.ceil((b - a) / s.upperMaxSpacingMm);
    for (let k = 0; k <= n; k++) {
      const x = a + ((b - a) * k) / n;
      if (
        p.rows.length &&
        p.members.some(
          (m) =>
            m.layer === "upper" &&
            Math.abs(to(m.start).x - x) < s.upperSection.widthMm - EPS,
        )
      )
        continue;
      line(x, "regular");
    }
  }
  if (s.lowerSpacingMm !== null) {
    const n = Math.ceil((maxY - minY) / s.lowerSpacingMm);
    if (n > FRAMING.maxMembers) throw Error("Alt profil sınırı aşıldı.");
    for (let i = 0; i <= n; i++)
      for (const c of clipSegment(
        doc,
        to({ x: minX, y: minY + ((maxY - minY) * i) / n }),
        to({ x: maxX, y: minY + ((maxY - minY) * i) / n }),
      ))
        add("lower", "regular", c.start, c.end);
  }
  for (const path of paths)
    for (let i = 0; i < path.points.length; i++)
      for (const c of clipSegment(
        doc,
        path.points[i]!,
        path.points[(i + 1) % path.points.length]!,
      ))
        add("perimeter", "boundary", c.start, c.end);
  if (p.settings.supportSpacingMm !== null)
    for (const m of p.members.filter((m) => m.layer === "lower")) {
      const n = Math.max(
        1,
        Math.ceil(m.lengthMm / p.settings.supportSpacingMm),
      );
      if (n > FRAMING.maxMembers || p.supports.length + n > FRAMING.maxMembers)
        throw Error("Mesnet sınırı aşıldı.");
      for (let i = 0; i <= n; i++)
        p.supports.push({
          id: `${m.id}-S-${i}`,
          at: {
            x: m.start.x + ((m.end.x - m.start.x) * i) / n,
            y: m.start.y + ((m.end.y - m.start.y) * i) / n,
          },
          memberId: m.id,
          type: "foot",
          method: "automatic",
          verified: false,
        });
    }
  return refreshFraming(p, doc);
}
export function refreshFraming(
  plan: FramingPlan,
  doc: DrawingDocument,
): FramingPlan {
  const p: FramingPlan = JSON.parse(JSON.stringify(plan));
  p.technicalStatus = "requires-approval";
  p.connections = [];
  p.splices = [];
  for (const m of p.members) {
    m.lengthMm = distance(m.start, m.end);
    m.zBottomMm = m.layer === "lower" ? 0 : p.settings.lowerSection.heightMm;
    m.connectionIds = [];
    m.productionReady = false;
    m.requiresSplice = m.lengthMm > p.settings.stockLengthMm + EPS;
    if (m.requiresSplice)
      p.splices.push({
        id: `${m.id}-splice`,
        memberId: m.id,
        at: null,
        designed: false,
      });
  }
  const upperMembers = p.members.filter((m) => m.layer === "upper"),
    lowerMembers = p.members.filter((m) => m.layer === "lower");
  if (
    upperMembers.length * lowerMembers.length > FRAMING.maxPieces ||
    (upperMembers.length * (upperMembers.length - 1)) / 2 > FRAMING.maxPieces
  )
    throw Error(
      "Karkas eşleşme hesap sınırı aşıldı; profil aralıklarını artırın.",
    );
  for (const a of p.members.filter((m) => m.layer === "upper"))
    for (const b of p.members.filter((m) => m.layer === "lower")) {
      if (Math.abs(a.zBottomMm - (b.zBottomMm + b.section.heightMm)) > EPS)
        continue;
      const at = segmentIntersection(a.start, a.end, b.start, b.end);
      if (at) {
        if (p.connections.length >= FRAMING.maxPieces)
          throw Error("Karkas bağlantı sayısı sınırı aşıldı.");
        const id = `${p.id}-C-${p.connections.length + 1}`;
        p.connections.push({
          id,
          memberIds: [a.id, b.id],
          at,
          contactZMm: p.settings.lowerSection.heightMm,
          type: "crossing",
          designed: false,
        });
        a.connectionIds.push(id);
        b.connectionIds.push(id);
      }
    }
  p.warnings = validateFraming(p, doc);
  for (const j of p.joints) {
    const left = p.pieces.find((q) => q.id === j.leftPieceId),
      right = p.pieces.find((q) => q.id === j.rightPieceId);
    j.supportIds = [left?.endSupportId, right?.startSupportId].filter(
      (id): id is string => !!id && p.members.some((m) => m.id === id),
    );
    j.verified =
      !!left &&
      !!right &&
      j.supportIds.length === 2 &&
      new Set(j.supportIds).size === 2 &&
      !p.warnings.some(
        (w) =>
          w.code === "DECK_END_UNSUPPORTED" &&
          (w.pieceId === left.id || w.pieceId === right.id),
      ) &&
      !p.warnings.some(
        (w) =>
          [
            "PROFILE_OVERLAP",
            "PROFILE_FOOTPRINT_UNPROVEN",
            "MEMBER_OUTSIDE",
          ].includes(w.code) && j.supportIds.includes(w.memberId ?? ""),
      ) &&
      p.settings.doubleJointSupport &&
      (p.settings.jointGapMm ?? 0) >= (p.settings.installationGapMm ?? 0);
  }
  return p;
}
export function framingTotals(p: FramingPlan): FramingTotals {
  const sum = (layer: FramingMember["layer"]) =>
    p.members
      .filter((m) => m.layer === layer)
      .reduce((n, m) => n + distance(m.start, m.end), 0);
  return {
    upperCount: p.members.filter((m) => m.layer === "upper").length,
    upperLengthMm: sum("upper"),
    lowerCount: p.members.filter((m) => m.layer === "lower").length,
    lowerLengthMm: sum("lower"),
    perimeterLengthMm: sum("perimeter"),
    totalLengthMm: p.members.reduce((n, m) => n + distance(m.start, m.end), 0),
    jointCount: p.joints.length,
    supportCount: p.supports.length,
    connectionCount: p.connections.length,
  };
}

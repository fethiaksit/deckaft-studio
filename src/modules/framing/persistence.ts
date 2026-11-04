import type { FramingPlan, FramingMember } from "./model";
import { FRAMING } from "./config";
import { validPoint } from "../drawing/model";
import { validateSettings } from "./validation";
const fail = () => {
  throw new Error("Karkas kaydı geçersiz veya desteklenmeyen sürümde.");
};
const point = (v: unknown) =>
  !!v && typeof v === "object" && validPoint(v as { x: number; y: number });
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const text = (v: unknown) => typeof v === "string" && v.length > 0;
export function parseFraming(json: string): FramingPlan {
  const p = JSON.parse(json) as FramingPlan;
  if (
    !p ||
    p.version !== 1 ||
    !text(p.id) ||
    !text(p.projectId) ||
    !text(p.sourceGeometry) ||
    !text(p.createdAt) ||
    !text(p.updatedAt) ||
    !Number.isFinite(Date.parse(p.createdAt)) ||
    !Number.isFinite(Date.parse(p.updatedAt)) ||
    p.technicalStatus !== "requires-approval"
  )
    fail();
  validateSettings(p.settings);
  for (const key of [
    "members",
    "rows",
    "pieces",
    "joints",
    "connections",
    "supports",
    "splices",
    "manualChanges",
    "warnings",
  ] as const)
    if (!Array.isArray(p[key])) fail();
  if (
    p.members.length > FRAMING.maxMembers ||
    p.rows.length > FRAMING.maxRows ||
    p.pieces.length > FRAMING.maxPieces ||
    p.connections.length > FRAMING.maxPieces ||
    p.supports.length > FRAMING.maxPieces
  )
    fail();
  const ids = new Set<string>(),
    codes = new Set<string>();
  for (const m of p.members) {
    if (
      !m ||
      !text(m.id) ||
      ids.has(m.id) ||
      !text(m.code) ||
      codes.has(m.code) ||
      !["upper", "lower", "perimeter"].includes(m.layer) ||
      !["regular", "boundary", "jointSupport", "endSupport"].includes(m.role) ||
      !point(m.start) ||
      !point(m.end) ||
      !finite(m.lengthMm) ||
      m.lengthMm <= 0 ||
      Math.abs(
        m.lengthMm - Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y),
      ) > FRAMING.epsilonMm ||
      m.productionReady !== false ||
      typeof m.requiresSplice !== "boolean" ||
      !finite(m.zBottomMm) ||
      m.zBottomMm < 0 ||
      !["automatic", "manual"].includes(m.method) ||
      !Array.isArray(m.connectionIds) ||
      m.connectionIds.some((id) => !text(id))
    )
      fail();
    validateSettings({ ...p.settings, upperSection: m.section });
    ids.add(m.id);
    codes.add(m.code);
  }
  const unique = (items: { id: string }[]) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (!item || !text(item.id) || seen.has(item.id)) fail();
      seen.add(item.id);
    }
  };
  for (const items of [
    p.rows,
    p.pieces,
    p.joints,
    p.connections,
    p.supports,
    p.splices,
    p.manualChanges,
  ])
    unique(items);
  const pieces = new Set(p.pieces.map((q) => q.id)),
    rows = new Set(p.rows.map((q) => q.id)),
    connections = new Set(p.connections.map((q) => q.id));
  for (const row of p.rows)
    if (
      !point(row.start) ||
      !point(row.end) ||
      !finite(row.widthMm) ||
      row.widthMm <= 0 ||
      !Array.isArray(row.pieceIds) ||
      row.pieceIds.some((id) => !pieces.has(id))
    )
      fail();
  for (const piece of p.pieces)
    if (
      !rows.has(piece.rowId) ||
      !point(piece.start) ||
      !point(piece.end) ||
      !finite(piece.widthMm) ||
      piece.widthMm <= 0 ||
      !finite(piece.lengthMm) ||
      piece.lengthMm <= 0 ||
      Math.abs(
        piece.lengthMm -
          Math.hypot(piece.end.x - piece.start.x, piece.end.y - piece.start.y),
      ) > FRAMING.epsilonMm ||
      [piece.startSupportId, piece.endSupportId].some(
        (id) => id !== null && !text(id),
      )
    )
      fail();
  for (const c of p.connections)
    if (
      !point(c.at) ||
      !finite(c.contactZMm) ||
      c.type !== "crossing" ||
      c.designed !== false ||
      !Array.isArray(c.memberIds) ||
      c.memberIds.length !== 2 ||
      c.memberIds.some((id) => !ids.has(id))
    )
      fail();
  for (const m of p.members)
    if (m.connectionIds.some((id) => !connections.has(id))) fail();
  for (const s of p.supports)
    if (
      !point(s.at) ||
      s.verified !== false ||
      !["foot", "bearing"].includes(s.type) ||
      !["automatic", "manual"].includes(s.method) ||
      (s.memberId !== null && !ids.has(s.memberId))
    )
      fail();
  for (const j of p.joints)
    if (
      !rows.has(j.rowId) ||
      !pieces.has(j.leftPieceId) ||
      !pieces.has(j.rightPieceId) ||
      !point(j.at) ||
      typeof j.verified !== "boolean" ||
      !Array.isArray(j.supportIds) ||
      j.supportIds.some((id) => !ids.has(id))
    )
      fail();
  for (const s of p.splices)
    if (
      !ids.has(s.memberId) ||
      (s.at !== null && !point(s.at)) ||
      s.designed !== false
    )
      fail();
  for (const change of p.manualChanges)
    if (
      !text(change.kind) ||
      !text(change.at) ||
      !Number.isFinite(Date.parse(change.at))
    )
      fail();
  for (const w of p.warnings)
    if (!w || !text(w.code) || !text(w.message)) fail();
  return p;
}
export function memberSection(
  layer: FramingMember["layer"],
  plan: FramingPlan,
) {
  return {
    ...(layer === "upper"
      ? plan.settings.upperSection
      : layer === "lower"
        ? plan.settings.lowerSection
        : plan.settings.perimeterSection),
  };
}

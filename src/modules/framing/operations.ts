import type { DrawingDocument } from "../drawing/model";
import { validPoint } from "../drawing/model";
import type { PointMm } from "../geometry/model";
import type {
  FramingPlan,
  FramingLayer,
  FramingMember,
  FramingSupport,
} from "./model";
import { refreshFraming, sourceGeometrySignature } from "./engine";
import { containsSegment, pointInRing } from "./geometry";
import { memberSection } from "./persistence";
export function assertCurrent(plan: FramingPlan, doc: DrawingDocument) {
  if (plan.sourceGeometry !== sourceGeometrySignature(doc))
    throw new Error("Alan değişti; önce karkası yeniden oluşturun.");
}
function checked(doc: DrawingDocument, a: PointMm, b: PointMm) {
  if (!validPoint(a) || !validPoint(b) || !containsSegment(doc, a, b))
    throw new Error(
      "Profil sıfır uzunlukta olamaz ve bütünüyle kullanılabilir alanda kalmalıdır.",
    );
}
function changed(
  plan: FramingPlan,
  doc: DrawingDocument,
  kind: string,
  now: string,
  memberId?: string,
): FramingPlan {
  return refreshFraming(
    {
      ...plan,
      updatedAt: now,
      technicalStatus: "requires-approval",
      manualChanges: [
        ...plan.manualChanges,
        {
          id: `${plan.id}-edit-${plan.manualChanges.length + 1}`,
          kind,
          at: now,
          ...(memberId ? { memberId } : {}),
        },
      ],
    },
    doc,
  );
}
export function addMember(
  plan: FramingPlan,
  doc: DrawingDocument,
  input: { start: PointMm; end: PointMm; layer: FramingLayer },
  now: string,
): FramingPlan {
  assertCurrent(plan, doc);
  checked(doc, input.start, input.end);
  let n = 1;
  while (plan.members.some((m) => m.code === `M-${String(n).padStart(3, "0")}`))
    n++;
  const code = `M-${String(n).padStart(3, "0")}`,
    id = `${plan.id}-${code}`;
  const m: FramingMember = {
    id,
    code,
    layer: input.layer,
    role: "regular",
    start: { ...input.start },
    end: { ...input.end },
    lengthMm: Math.hypot(
      input.end.x - input.start.x,
      input.end.y - input.start.y,
    ),
    zBottomMm:
      input.layer === "lower" ? 0 : plan.settings.lowerSection.heightMm,
    section: memberSection(input.layer, plan),
    connectionIds: [],
    method: "manual",
    requiresSplice: false,
    productionReady: false,
  };
  return changed(
    { ...plan, members: [...plan.members, m] },
    doc,
    "add",
    now,
    id,
  );
}
export function updateMember(
  plan: FramingPlan,
  doc: DrawingDocument,
  id: string,
  input: {
    start?: PointMm;
    end?: PointMm;
    layer?: FramingLayer;
    lengthMm?: number;
    fixed?: "start" | "end";
  },
  now: string,
): FramingPlan {
  assertCurrent(plan, doc);
  const m = plan.members.find((m) => m.id === id);
  if (!m) throw new Error("Profil bulunamadı.");
  let start = input.start ?? m.start,
    end = input.end ?? m.end;
  if (input.lengthMm !== undefined) {
    const old = Math.hypot(end.x - start.x, end.y - start.y);
    if (
      !old ||
      !Number.isFinite(input.lengthMm) ||
      input.lengthMm <= 0 ||
      !input.fixed
    )
      throw new Error("Pozitif uzunluk ve sabit uç seçin.");
    const dx = ((end.x - start.x) * input.lengthMm) / old,
      dy = ((end.y - start.y) * input.lengthMm) / old;
    if (input.fixed === "start") end = { x: start.x + dx, y: start.y + dy };
    else start = { x: end.x - dx, y: end.y - dy };
  }
  checked(doc, start, end);
  const layer = input.layer ?? m.layer;
  if (!["upper", "lower", "perimeter"].includes(layer))
    throw new Error("Profil katmanı geçersiz.");
  return changed(
    {
      ...plan,
      members: plan.members.map((q) =>
        q.id === id
          ? {
              ...q,
              start: { ...start },
              end: { ...end },
              layer,
              section: memberSection(layer, plan),
              method: "manual",
            }
          : q,
      ),
    },
    doc,
    "update",
    now,
    id,
  );
}
export function translateMember(
  plan: FramingPlan,
  doc: DrawingDocument,
  id: string,
  dx: number,
  dy: number,
  now: string,
): FramingPlan {
  const m = plan.members.find((m) => m.id === id);
  if (!m) throw new Error("Profil bulunamadı.");
  return updateMember(
    plan,
    doc,
    id,
    {
      start: { x: m.start.x + dx, y: m.start.y + dy },
      end: { x: m.end.x + dx, y: m.end.y + dy },
    },
    now,
  );
}
export function removeMember(
  plan: FramingPlan,
  doc: DrawingDocument,
  id: string,
  now: string,
): FramingPlan {
  assertCurrent(plan, doc);
  if (!plan.members.some((m) => m.id === id))
    throw new Error("Profil bulunamadı.");
  return changed(
    {
      ...plan,
      members: plan.members.filter((m) => m.id !== id),
      supports: plan.supports.filter((s) => s.memberId !== id),
    },
    doc,
    "delete",
    now,
    id,
  );
}
export function updateSupport(
  plan: FramingPlan,
  doc: DrawingDocument,
  input: {
    id?: string;
    at: PointMm;
    type: "foot" | "bearing";
    memberId: string | null;
  },
  now: string,
): FramingPlan {
  assertCurrent(plan, doc);
  const outer = doc.paths.find((p) => p.role === "outer");
  if (
    !validPoint(input.at) ||
    !outer ||
    pointInRing(input.at, outer.points) < 0 ||
    doc.paths.some(
      (p) => p.role === "void" && pointInRing(input.at, p.points) > 0,
    )
  )
    throw new Error("Mesnet kullanılabilir alan içinde olmalı.");
  if (
    input.memberId !== null &&
    !plan.members.some((m) => m.id === input.memberId && m.layer === "lower")
  )
    throw new Error("Mesnet için geçerli bir alt profil seçin.");
  if (input.id && !plan.supports.some((s) => s.id === input.id))
    throw new Error("Mesnet bulunamadı.");
  let n = 1;
  while (plan.supports.some((s) => s.id === `${plan.id}-manual-support-${n}`))
    n++;
  const id = input.id ?? `${plan.id}-manual-support-${n}`;
  const support: FramingSupport = {
    id,
    at: { ...input.at },
    memberId: input.memberId,
    type: input.type,
    method: "manual",
    verified: false,
  };
  return changed(
    {
      ...plan,
      supports: input.id
        ? plan.supports.map((s) => (s.id === id ? support : s))
        : [...plan.supports, support],
    },
    doc,
    "support",
    now,
  );
}
export function removeSupport(
  plan: FramingPlan,
  doc: DrawingDocument,
  id: string,
  now: string,
): FramingPlan {
  assertCurrent(plan, doc);
  return changed(
    { ...plan, supports: plan.supports.filter((s) => s.id !== id) },
    doc,
    "support-delete",
    now,
  );
}

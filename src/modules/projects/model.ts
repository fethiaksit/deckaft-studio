export const projectTypes = ["Deck", "Teras", "Pergola", "Diğer"] as const;
export type ProjectType = (typeof projectTypes)[number];
export interface ProjectInput {
  name: string;
  customer: string;
  city: string;
  district: string;
  description: string;
  type: ProjectType;
}
export interface Project extends ProjectInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export function validateProject(input: ProjectInput): ProjectInput {
  const value = {
    ...input,
    name: input.name.trim(),
    customer: input.customer.trim(),
    city: input.city.trim(),
    district: input.district.trim(),
    description: input.description.trim(),
  };
  if (!value.name || value.name.length > 120)
    throw new Error("Proje adı 1–120 karakter olmalı.");
  if (!value.city || !value.district)
    throw new Error("İl ve ilçe bilgilerini girin.");
  if (
    value.city.length > 80 ||
    value.district.length > 80 ||
    value.customer.length > 120 ||
    value.description.length > 2000
  )
    throw new Error("Girilen metin çok uzun.");
  if (!projectTypes.includes(value.type))
    throw new Error("Geçerli bir proje türü seçin.");
  return value;
}

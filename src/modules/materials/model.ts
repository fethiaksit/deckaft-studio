export interface MaterialProfile {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  stockLengthMm: number;
  material: "wood" | "aluminium" | "steel" | "composite";
}
export interface MaterialQuantity {
  profileId: string;
  quantity: number;
  lengthMm: number;
}

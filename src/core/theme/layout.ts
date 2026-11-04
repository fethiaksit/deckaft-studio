export const isTabletLayout = (width: number, height: number): boolean =>
  width >= 700 && Math.min(width, height) >= 600;

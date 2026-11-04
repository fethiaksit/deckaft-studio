import { View } from "react-native";
import { Label } from "../../../components/ui";
import { useTheme } from "../../../core/theme/theme";
import type { DrawingWorkspace } from "../hooks/useDrawingWorkspace";
const number = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
export function AreaSummary({
  report,
  compact = false,
}: {
  report: DrawingWorkspace["report"];
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        padding: compact ? 10 : 14,
        gap: 6,
        backgroundColor: colors.surface,
        borderRadius: compact ? 0 : 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Label
          style={{
            fontWeight: "700",
            color: report.valid ? colors.accent : colors.muted,
            fontSize: compact ? 17 : 22,
          }}
        >
          Net {number(report.netM2)} m²
        </Label>
        {compact && report.valid && (
          <Label muted style={{ fontSize: 11 }}>
            Brüt {number(report.grossM2)} · Hariç {number(report.excludedM2)}
          </Label>
        )}
      </View>
      {!compact && (
        <>
          <Label muted>Brüt alan: {number(report.grossM2)} m²</Label>
          <Label muted>Hariç tutulan: {number(report.excludedM2)} m²</Label>
          <Label muted>Dış çevre: {number(report.perimeterM)} m</Label>
        </>
      )}
      {!report.valid && (
        <Label style={{ color: colors.danger, fontSize: 11, lineHeight: 16 }}>
          {report.errors[0]} Kesin alan hesaplanmadı.
        </Label>
      )}
    </View>
  );
}

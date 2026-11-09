import Svg, { Line, Rect } from "react-native-svg";
import { View } from "react-native";
import type { FramingPlan } from "../../framing/model";
import { useTheme } from "../../../core/theme/theme";
export function SourcePreview({
  source,
  selected,
}: {
  source: FramingPlan;
  selected: string;
}) {
  const { colors } = useTheme();
  const points = source.members.flatMap((m) => [m.start, m.end]);
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y),
    minX = Math.min(...xs),
    minY = Math.min(...ys);
  const spanX = Math.max(1, Math.max(...xs) - minX),
    spanY = Math.max(1, Math.max(...ys) - minY),
    scale = Math.min(276 / spanX, 176 / spanY);
  const x = (v: number) => 12 + (v - minX) * scale,
    y = (v: number) => 12 + (v - minY) * scale;
  return (
    <View accessibilityLabel={`Karkasta vurgulanan profil: ${selected}`}>
      <Svg width="100%" height={200} viewBox="0 0 300 200">
        <Rect width={300} height={200} rx={8} fill={colors.background} />
        {[...source.members]
          .sort((a, b) => Number(a.id === selected) - Number(b.id === selected))
          .map((m) => (
            <Line
              key={m.id}
              x1={x(m.start.x)}
              y1={y(m.start.y)}
              x2={x(m.end.x)}
              y2={y(m.end.y)}
              stroke={
                m.id === selected
                  ? colors.accent
                  : m.layer === "lower"
                    ? "#5B8BAF"
                    : "#8A6569"
              }
              strokeWidth={m.id === selected ? 4 : 1.3}
            />
          ))}
      </Svg>
    </View>
  );
}

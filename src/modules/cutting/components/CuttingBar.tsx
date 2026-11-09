import { Pressable, ScrollView, View } from "react-native";
import { Card, Label } from "../../../components/ui";
import { useTheme } from "../../../core/theme/theme";
import type { CutStock, CuttingSettings } from "../model";
const palette = ["#2C6876", "#74603D", "#574C85", "#34745C", "#7D4B52"];
export function CuttingBar({
  stock,
  settings,
  selected,
  onSelect,
}: {
  stock: CutStock;
  settings: CuttingSettings;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { colors } = useTheme();
  const cm = (n: number) => Number((n / 10).toFixed(3));
  // Every segment has its physical proportional width. Full labels below are
  // independently scrollable and tappable even for very short parts.
  const width = Math.max(900, stock.stockLengthMm * 0.15),
    px = width / stock.stockLengthMm;
  const startTrim = settings.startTrimMm;
  return (
    <Card style={{ padding: 12, gap: 8 }}>
      <Label style={{ fontWeight: "700" }}>
        Profil {stock.id} — {cm(stock.stockLengthMm)} cm
      </Label>
      <Label muted style={{ fontSize: 11 }}>
        {stock.sectionKey.replaceAll("|", " / ")}
      </Label>
      <ScrollView
        horizontal
        accessibilityLabel={`${stock.id} kesim çubuğu`}
        showsHorizontalScrollIndicator
      >
        <View style={{ width, gap: 8, paddingBottom: 10 }}>
          <View
            style={{
              flexDirection: "row",
              height: 66,
              backgroundColor: colors.raised,
              borderRadius: 5,
              overflow: "hidden",
            }}
          >
            {startTrim > 0 && (
              <View
                style={{ width: startTrim * px, backgroundColor: "#AA5454" }}
              />
            )}
            {startTrim > 0 && (
              <View
                style={{
                  width: settings.cutKerfMm * px,
                  backgroundColor: "#F57C57",
                }}
              />
            )}
            {stock.pieces.map((p, i) => (
              <View key={p.memberId} style={{ flexDirection: "row" }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${p.code}, ${cm(p.lengthMm)} cm, ${stock.id}`}
                  onPress={() => onSelect(p.memberId)}
                  style={{
                    width: p.lengthMm * px,
                    backgroundColor: palette[i % palette.length],
                    borderWidth: 2,
                    borderColor:
                      selected === p.memberId ? colors.accent : "transparent",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                    overflow: "hidden",
                  }}
                >
                  <Label
                    numberOfLines={1}
                    style={{ color: "#FFFFFF", fontWeight: "700" }}
                  >
                    {p.code}
                  </Label>
                  <Label
                    numberOfLines={1}
                    style={{ color: "#FFFFFF", fontSize: 12 }}
                  >
                    {cm(p.lengthMm)} cm
                  </Label>
                </Pressable>
                <View
                  style={{
                    width: settings.cutKerfMm * px,
                    backgroundColor: "#F57C57",
                  }}
                />
              </View>
            ))}
            <View
              style={{
                width: stock.remainderMm * px,
                backgroundColor: stock.reusableMm > 0 ? "#526455" : "#87574C",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <Label
                numberOfLines={1}
                style={{ color: "#FFFFFF", fontSize: 11, padding: 4 }}
              >
                {stock.reusableMm > 0 ? "Artık" : "Fire"}{" "}
                {cm(stock.remainderMm)} cm
              </Label>
            </View>
            {settings.endTrimMm > 0 && (
              <>
                <View
                  style={{
                    width: settings.cutKerfMm * px,
                    backgroundColor: "#F57C57",
                  }}
                />
                <View
                  style={{
                    width: settings.endTrimMm * px,
                    backgroundColor: "#AA5454",
                  }}
                />
              </>
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {stock.pieces.map((p) => (
              <Pressable
                key={p.memberId}
                onPress={() => onSelect(p.memberId)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 9,
                  backgroundColor: colors.raised,
                  borderRadius: 6,
                }}
              >
                <Label>
                  {p.code} · {cm(p.lengthMm)} cm
                </Label>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
      <Label muted style={{ fontSize: 12 }}>
        Testere {cm(stock.kerfMm)} cm · Uç düzeltme {cm(stock.trimMm)} cm ·
        Kalan {cm(stock.remainderMm)} cm (
        {stock.reusableMm > 0 ? "kullanılabilir artık" : "fire"})
      </Label>
    </Card>
  );
}

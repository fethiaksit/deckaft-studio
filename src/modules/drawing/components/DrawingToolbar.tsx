import { ScrollView, View } from "react-native";
import {
  PenTool,
  Ruler,
  Scan,
  Hand,
  Undo2,
  Redo2,
  Grid2X2,
  Trash2,
  Plus,
  Minus,
  Focus,
} from "lucide-react-native";
import { IconButton, Label } from "../../../components/ui";
import type { DrawingTool } from "../model";
import { useTheme } from "../../../core/theme/theme";
export function DrawingToolbar({
  tool,
  setTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  grid,
  toggleGrid,
  selected,
  onDelete,
  onZoom,
  onReset,
}: {
  tool: DrawingTool;
  setTool: (t: DrawingTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  grid: boolean;
  toggleGrid: () => void;
  selected: boolean;
  onDelete: () => void;
  onZoom: (factor: number) => void;
  onReset: () => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ alignItems: "center", padding: 8, gap: 5 }}
      style={{ flexGrow: 0, backgroundColor: colors.surface }}
    >
      {(
        [
          { id: "draw", title: "Çizgi", icon: PenTool },
          { id: "measure", title: "Ölçü", icon: Ruler },
          { id: "select", title: "Alan seçimi", icon: Scan },
          { id: "pan", title: "Kaydır", icon: Hand },
        ] as const
      ).map(({ id, title, icon }) => (
        <View key={id} style={{ alignItems: "center" }}>
          <IconButton
            icon={icon}
            label={title}
            active={tool === id}
            onPress={() => setTool(id)}
          />
          <Label muted style={{ fontSize: 9 }}>
            {title}
          </Label>
        </View>
      ))}
      <View
        style={{
          width: 1,
          height: 30,
          backgroundColor: colors.border,
          marginHorizontal: 3,
        }}
      />
      <IconButton
        icon={Undo2}
        label="Geri al"
        disabled={!canUndo}
        onPress={onUndo}
      />
      <IconButton
        icon={Redo2}
        label="İleri al"
        disabled={!canRedo}
        onPress={onRedo}
      />
      <IconButton
        icon={Trash2}
        label="Seçimi sil"
        disabled={!selected}
        onPress={onDelete}
      />
      <IconButton
        icon={Grid2X2}
        label="Izgarayı aç veya kapat"
        active={grid}
        onPress={toggleGrid}
      />
      <IconButton icon={Minus} label="Uzaklaştır" onPress={() => onZoom(0.8)} />
      <IconButton
        icon={Plus}
        label="Yakınlaştır"
        onPress={() => onZoom(1.25)}
      />
      <IconButton icon={Focus} label="Görünümü sıfırla" onPress={onReset} />
    </ScrollView>
  );
}

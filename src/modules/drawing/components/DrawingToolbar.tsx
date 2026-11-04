import { ScrollView, View } from "react-native";
import {
  PenTool,
  Ruler,
  Scan,
  Move,
  Hand,
  Undo2,
  Redo2,
  Grid2X2,
  Trash2,
  Plus,
  Minus,
  Focus,
  Check,
} from "lucide-react-native";
import { IconButton, Label } from "../../../components/ui";
import { useTheme } from "../../../core/theme/theme";
import type { DrawingWorkspace } from "../hooks/useDrawingWorkspace";
export function DrawingToolbar({
  workspace: w,
  vertical = false,
}: {
  workspace: DrawingWorkspace;
  vertical?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal={!vertical}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={{
        flexGrow: 0,
        backgroundColor: colors.surface,
        width: vertical ? 64 : undefined,
      }}
      contentContainerStyle={{ padding: 8, gap: 5, alignItems: "center" }}
    >
      {(
        [
          { id: "draw", label: "Çizgi", icon: PenTool },
          { id: "measure", label: "Ölçü", icon: Ruler },
          { id: "select", label: "Seç", icon: Scan },
          { id: "move", label: "Taşı", icon: Move },
          { id: "pan", label: "Kaydır", icon: Hand },
        ] as const
      ).map((t) => (
        <View key={t.id} style={{ alignItems: "center" }}>
          <IconButton
            icon={t.icon}
            label={t.label}
            active={w.tool === t.id}
            disabled={w.saving}
            onPress={() => w.changeTool(t.id)}
          />
          <Label muted style={{ fontSize: 9 }}>
            {t.label}
          </Label>
        </View>
      ))}
      <View
        style={{
          width: vertical ? 30 : 1,
          height: vertical ? 1 : 30,
          backgroundColor: colors.border,
          margin: 4,
        }}
      />
      <IconButton
        icon={Check}
        label="Alanı kapat"
        disabled={
          w.saving ||
          !w.activePath ||
          w.activePath.closed ||
          w.activePath.points.length < 3
        }
        onPress={w.close}
      />
      <IconButton
        icon={Undo2}
        label="Geri al"
        disabled={w.saving || !w.history.past.length}
        onPress={() => w.historyStep("undo")}
      />
      <IconButton
        icon={Redo2}
        label="İleri al"
        disabled={w.saving || !w.history.future.length}
        onPress={() => w.historyStep("redo")}
      />
      <IconButton
        icon={Trash2}
        label="Seçili alanı veya ölçüyü sil"
        disabled={w.saving || !w.selection}
        onPress={w.remove}
      />
      <IconButton
        icon={Grid2X2}
        label="Izgara görünürlüğü"
        active={w.document.layers.grid}
        disabled={w.saving}
        onPress={() =>
          w.updateSettings({
            layers: { ...w.document.layers, grid: !w.document.layers.grid },
          })
        }
      />
      <IconButton icon={Minus} label="Uzaklaştır" onPress={() => w.zoom(0.8)} />
      <IconButton
        icon={Plus}
        label="Yakınlaştır"
        onPress={() => w.zoom(1.25)}
      />
      <IconButton icon={Focus} label="Çizimi ortala" onPress={w.fit} />
    </ScrollView>
  );
}

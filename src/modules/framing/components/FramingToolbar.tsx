import { View, ScrollView } from "react-native";
import {
  Scan,
  Hand,
  Plus,
  Move,
  Undo2,
  Redo2,
  Trash2,
  Focus,
  Settings2,
  ChartNoAxesCombined,
  RotateCcw,
  Minus,
} from "lucide-react-native";
import { IconButton, Label } from "../../../components/ui";
import { useTheme } from "../../../core/theme/theme";
import type { FramingWorkspace } from "../hooks/useFramingWorkspace";
export function FramingToolbar({
  workspace: w,
  vertical = false,
}: {
  workspace: FramingWorkspace;
  vertical?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal={!vertical}
      showsHorizontalScrollIndicator={false}
      style={{
        flexGrow: 0,
        width: vertical ? 64 : undefined,
        backgroundColor: colors.surface,
      }}
      contentContainerStyle={{ padding: 8, gap: 5, alignItems: "center" }}
    >
      {(
        [
          { id: "select", label: "Seç", icon: Scan },
          { id: "move", label: "Taşı", icon: Move },
          { id: "add", label: "Ekle", icon: Plus },
          { id: "pan", label: "Kaydır", icon: Hand },
        ] as const
      ).map((t) => (
        <View key={t.id} style={{ alignItems: "center" }}>
          <IconButton
            icon={t.icon}
            label={`Profil ${t.label}`}
            active={w.tool === t.id}
            disabled={w.saving || (!w.plan && t.id !== "pan")}
            onPress={() => w.changeTool(t.id)}
          />
          <Label muted style={{ fontSize: 9 }}>
            {t.label}
          </Label>
        </View>
      ))}
      <IconButton
        icon={Undo2}
        label="Karkas geri al"
        disabled={w.saving || !w.history.past.length}
        onPress={() => w.historyStep("undo")}
      />
      <IconButton
        icon={Redo2}
        label="Karkas ileri al"
        disabled={w.saving || !w.history.future.length}
        onPress={() => w.historyStep("redo")}
      />
      <IconButton
        icon={Trash2}
        label="Profili sil"
        disabled={w.saving || !w.selected || w.stale}
        onPress={w.deleteSelected}
      />
      <IconButton icon={Focus} label="Karkası ortala" onPress={w.fit} />
      <IconButton
        icon={Minus}
        label="Karkası uzaklaştır"
        onPress={() => w.zoom(0.8)}
      />
      <IconButton
        icon={Plus}
        label="Karkası yakınlaştır"
        onPress={() => w.zoom(1.25)}
      />
      <IconButton
        icon={Settings2}
        label="Karkas ayarları"
        onPress={() => w.setPanel("settings")}
      />
      <IconButton
        icon={ChartNoAxesCombined}
        label="Metraj ve uyarılar"
        onPress={() => w.setPanel("plan")}
      />
      <IconButton
        icon={RotateCcw}
        label="Otomatik plana dön"
        disabled={!w.plan || w.saving}
        onPress={w.resetAuto}
      />
    </ScrollView>
  );
}

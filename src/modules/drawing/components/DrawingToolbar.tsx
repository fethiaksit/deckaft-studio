import { useState } from "react";
import { ScrollView, View } from "react-native";
import {
  PenTool,
  Ruler,
  Scan,
  Move,
  Hand,
  Undo2,
  Redo2,
  Trash2,
  Plus,
  Minus,
  Focus,
  Check,
  Ellipsis,
  ArrowLeft,
  type LucideIcon,
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
  const [advanced, setAdvanced] = useState(false);
  const main = !advanced || vertical;
  const extra = advanced || vertical;
  function control(
    icon: LucideIcon,
    label: string,
    onPress: () => void,
    disabled = false,
    active = false,
    caption?: string,
  ) {
    return (
      <View key={label} style={{ alignItems: "center" }}>
        <IconButton
          icon={icon}
          label={label}
          onPress={onPress}
          disabled={disabled || w.saving}
          active={active}
        />
        <Label muted style={{ fontSize: 9, lineHeight: 13 }}>
          {caption ?? label}
        </Label>
      </View>
    );
  }
  return (
    <ScrollView
      horizontal={!vertical}
      showsHorizontalScrollIndicator={false}
      style={{
        flexGrow: 0,
        backgroundColor: colors.surface,
        width: vertical ? 68 : undefined,
        height: vertical ? undefined : 68,
      }}
      contentContainerStyle={{ padding: 5, gap: 3, alignItems: "center" }}
    >
      {main && (
        <>
          {control(
            PenTool,
            "Çiz",
            () => w.changeTool("draw"),
            false,
            w.tool === "draw",
          )}
          {control(
            Scan,
            "Seç",
            () => w.changeTool("select"),
            false,
            w.tool === "select",
          )}
          {control(
            Move,
            "Taşı",
            () => w.changeTool("move"),
            false,
            w.tool === "move",
          )}
          {control(
            Trash2,
            "Seçili alanı veya ölçüyü sil",
            w.remove,
            !w.selection,
            false,
            "Sil",
          )}
          {control(
            Check,
            "Alanı kapat",
            w.close,
            !w.activePath ||
              w.activePath.closed ||
              w.activePath.points.length < 3,
            false,
            "Kapat",
          )}
          {control(
            Focus,
            "Çizimi Ekrana Sığdır",
            w.fit,
            false,
            false,
            "Sığdır",
          )}
        </>
      )}
      {extra && (
        <>
          {control(
            Undo2,
            "Geri al",
            () => w.historyStep("undo"),
            !w.history.past.length,
          )}
          {control(
            Redo2,
            "İleri al",
            () => w.historyStep("redo"),
            !w.history.future.length,
          )}
          {control(
            Ruler,
            "Ölçü",
            () => w.changeTool("measure"),
            false,
            w.tool === "measure",
          )}
          {control(
            Hand,
            "Kaydır",
            () => w.changeTool("pan"),
            false,
            w.tool === "pan",
          )}
          {control(Minus, "Uzaklaştır", () => w.zoom(0.8), false, false, "−")}
          {control(Plus, "Yakınlaştır", () => w.zoom(1.25), false, false, "+")}
        </>
      )}
      {!vertical &&
        control(
          advanced ? ArrowLeft : Ellipsis,
          advanced ? "Çizim araçlarına dön" : "Diğer çizim araçları",
          () => setAdvanced((v) => !v),
          false,
          false,
          advanced ? "Geri" : "Diğer",
        )}
    </ScrollView>
  );
}

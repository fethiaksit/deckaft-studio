import ProjectsScreen from "./ProjectsScreen";
import { useLocalSearchParams, router } from "expo-router";
import { Map, Layers, Scissors, FileText } from "lucide-react-native";
import { Page, Card, Label, Button } from "../components/ui";
import { modules, type ModuleId } from "../core/config";
import { useTheme } from "../core/theme/theme";
export default function ModuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const module = modules[id as ModuleId];
  if (id === "framing") return <ProjectsScreen framing />;
  if (!module) return <Page title="Modül bulunamadı" back />;
  const Icon = { map: Map, layers: Layers, scissors: Scissors, file: FileText }[
    module.icon
  ];
  return (
    <Page title={module.title} back>
      <Card style={{ padding: 24 }}>
        <Icon size={36} color={colors.accent} />
        <Label style={{ color: colors.accent, fontWeight: "600" }}>
          Hazırlık aşamasında
        </Label>
        <Label muted>{module.description}</Label>
        <Label muted>
          FAZ 00 kapsamında veri modelleri ve modül yapısı hazırlandı. Bu
          ekranda henüz hesaplama veya çıktı üretilmez.
        </Label>
        <Button
          title="Projelerime dön"
          variant="secondary"
          onPress={() => router.replace("/projects")}
        />
      </Card>
    </Page>
  );
}

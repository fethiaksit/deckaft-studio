import { Pressable, View } from "react-native";
import { ArrowUpRight, MapPin } from "lucide-react-native";
import { router } from "expo-router";
import type { Project } from "../modules/projects/model";
import { Card, Label } from "./ui";
import { useTheme } from "../core/theme/theme";
export function ProjectCard({ project }: { project: Project }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${project.name} projesini aç`}
      onPress={() =>
        router.push({ pathname: "/project/[id]", params: { id: project.id } })
      }
    >
      <Card>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Label
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: colors.accent,
              letterSpacing: 1,
            }}
          >
            {project.type.toLocaleUpperCase("tr-TR")}
          </Label>
          <ArrowUpRight size={19} color={colors.muted} />
        </View>
        <Label style={{ fontSize: 18, fontWeight: "600" }}>
          {project.name}
        </Label>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <MapPin size={13} color={colors.muted} />
          <Label muted style={{ fontSize: 12 }}>
            {project.city} / {project.district}
          </Label>
        </View>
        <Label muted style={{ fontSize: 11 }}>
          Son düzenleme ·{" "}
          {new Date(project.updatedAt).toLocaleDateString("tr-TR")}
        </Label>
      </Card>
    </Pressable>
  );
}

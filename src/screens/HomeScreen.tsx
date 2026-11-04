import { useCallback } from "react";
import { View, Pressable, Alert } from "react-native";
import { useFocusEffect, router } from "expo-router";
import {
  Bell,
  UserRound,
  Plus,
  FolderOpen,
  PenTool,
  Map,
  Layers,
  Scissors,
  FileText,
  Hexagon,
  type LucideIcon,
} from "lucide-react-native";
import {
  Page,
  Label,
  Title,
  Button,
  IconButton,
  Card,
  MenuRow,
  StateView,
} from "../components/ui";
import { ProjectCard } from "../components/ProjectCard";
import { useTheme, useResponsive } from "../core/theme/theme";
import { useProjects } from "../core/store/projects";
import { useRepository } from "../core/db/provider";
const tools = [
  { id: "maps", title: "Ada / Parsel Sorgulama", icon: Map },
  { id: "framing", title: "Karkas Planı", icon: Layers },
  { id: "cutting", title: "Malzeme ve Kesim Listesi", icon: Scissors },
  { id: "exports", title: "PDF Çıktılar", icon: FileText },
] as const;
function QuickAction({
  title,
  detail,
  icon: Icon,
  onPress,
}: {
  title: string;
  detail: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}
    >
      <Card style={{ padding: 14, gap: 6 }}>
        <Icon size={20} color={colors.accent} />
        <Label style={{ fontWeight: "600" }}>{title}</Label>
        <Label muted style={{ fontSize: 11 }}>
          {detail}
        </Label>
      </Card>
    </Pressable>
  );
}
export default function HomeScreen() {
  const { colors } = useTheme();
  const { tablet, width } = useResponsive();
  const repo = useRepository();
  const { projects, load, loading, error } = useProjects();
  useFocusEffect(
    useCallback(() => {
      void load(repo);
    }, [load, repo]),
  );
  const projectStatus = error ? (
    <StateView
      title="Projeler yüklenemedi"
      description={error}
      action={<Button title="Tekrar dene" onPress={() => void load(repo)} />}
    />
  ) : projects.length ? (
    projects
      .slice(0, tablet ? 2 : 1)
      .map((p) => <ProjectCard key={p.id} project={p} />)
  ) : (
    <Label muted style={{ fontSize: 12 }}>
      {loading
        ? "Projeler yükleniyor…"
        : "İlk projenizi oluşturduğunuzda burada görünecek."}
    </Label>
  );
  return (
    <Page>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginTop: -20,
        }}
      >
        <View
          style={{
            backgroundColor: colors.accent,
            padding: 9,
            borderRadius: 12,
          }}
        >
          <Hexagon color={colors.accentText} size={24} />
        </View>
        <View style={{ flex: 1 }}>
          <Label
            style={{
              fontSize: width < 360 ? 16 : 20,
              fontWeight: "800",
              letterSpacing: -0.6,
            }}
          >
            DeckAft{" "}
            <Label
              style={{ fontSize: width < 360 ? 16 : 20, fontWeight: "400" }}
            >
              Studio
            </Label>
          </Label>
          {tablet && (
            <Label muted style={{ fontSize: 10, letterSpacing: 1.7 }}>
              TASARLA. PLANLA. UYGULA.
            </Label>
          )}
        </View>
        <IconButton
          icon={Bell}
          label="Bildirimler"
          onPress={() =>
            Alert.alert(
              "Bildirimler",
              "Henüz bildiriminiz yok. Bu sürüm yerel olarak çalışır.",
            )
          }
        />
        <IconButton
          icon={UserRound}
          label="Kullanıcı alanı"
          onPress={() => router.push("/settings")}
        />
      </View>
      <View style={{ gap: 5 }}>
        <Label muted style={{ fontSize: 11, letterSpacing: 1.3 }}>
          ÇALIŞMA ALANINIZ
        </Label>
        <Title>
          {tablet
            ? "İyi bir uygulama, sağlam bir planla başlar."
            : "Her proje, sağlam bir planla başlar."}
        </Title>
      </View>
      <View style={{ flexDirection: tablet ? "row" : "column", gap: 14 }}>
        <Card
          style={{
            flex: tablet ? 1.3 : undefined,
            borderColor: colors.accent,
            padding: tablet ? 20 : 14,
            gap: 10,
          }}
        >
          {tablet && (
            <>
              <Label style={{ fontSize: 21, fontWeight: "600" }}>
                Fikrinizden ilk çizgiye.
              </Label>
              <Label muted>
                Projenizi oluşturun, ölçülerinizi çizmeye başlayın.
              </Label>
            </>
          )}
          <Button
            title="Yeni Proje Oluştur"
            icon={Plus}
            onPress={() => router.push("/project/new")}
          />
          <Label muted style={{ fontSize: 11, textAlign: "center" }}>
            Deck · Teras · Pergola · Diğer
          </Label>
        </Card>
        {tablet ? (
          <Card style={{ flex: 1, paddingVertical: 4, gap: 0 }}>
            <MenuRow
              icon={FolderOpen}
              title="Projelerim"
              description={`${projects.length} yerel proje`}
              onPress={() => router.push("/projects")}
            />
            <MenuRow
              icon={PenTool}
              title="Alan Çizimi"
              description="Milimetre tabanlı çalışma alanı"
              onPress={() => router.push("/draw")}
            />
          </Card>
        ) : (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <QuickAction
              title="Projelerim"
              detail={`${projects.length} yerel proje`}
              icon={FolderOpen}
              onPress={() => router.push("/projects")}
            />
            <QuickAction
              title="Alan Çizimi"
              detail="Çizim çalışma alanı"
              icon={PenTool}
              onPress={() => router.push("/draw")}
            />
          </View>
        )}
      </View>
      <View style={{ flexDirection: tablet ? "row" : "column", gap: 20 }}>
        <View style={{ flex: 1, gap: 10 }}>
          <Label
            style={{ fontSize: 11, letterSpacing: 1.2, fontWeight: "600" }}
          >
            PROJE ARAÇLARI
          </Label>
          {tablet ? (
            <Card style={{ gap: 0, paddingVertical: 0 }}>
              {tools.map((t) => (
                <MenuRow
                  key={t.id}
                  icon={t.icon}
                  title={t.title}
                  badge="HAZIRLIK"
                  onPress={() =>
                    router.push({
                      pathname: "/module/[id]",
                      params: { id: t.id },
                    })
                  }
                />
              ))}
            </Card>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {tools.map(({ id, title, icon: Icon }) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: "/module/[id]", params: { id } })
                  }
                  style={({ pressed }) => ({
                    width: "48%",
                    flexGrow: 1,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Card style={{ padding: 12, gap: 5, minHeight: 88 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Icon size={18} color={colors.accent} />
                      <Label muted style={{ fontSize: 8, letterSpacing: 0.5 }}>
                        HAZIRLIK
                      </Label>
                    </View>
                    <Label
                      style={{
                        fontWeight: "600",
                        fontSize: 12,
                        lineHeight: 17,
                      }}
                    >
                      {title}
                    </Label>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Label
              style={{ fontSize: 11, letterSpacing: 1.2, fontWeight: "600" }}
            >
              SON PROJELER
            </Label>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/projects")}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Label style={{ color: colors.accent, fontSize: 12 }}>
                Tümünü gör ↗
              </Label>
            </Pressable>
          </View>
          {projectStatus}
        </View>
      </View>
    </Page>
  );
}

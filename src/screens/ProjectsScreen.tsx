import { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Plus } from "lucide-react-native";
import { Page, Button, Field, StateView } from "../components/ui";
import { ProjectCard } from "../components/ProjectCard";
import { useProjects } from "../core/store/projects";
import { useRepository } from "../core/db/provider";
import { useResponsive } from "../core/theme/theme";
export default function ProjectsScreen({
  drawing = false,
  framing = false,
  cutting = false,
}: {
  drawing?: boolean;
  framing?: boolean;
  cutting?: boolean;
}) {
  const repo = useRepository();
  const { tablet } = useResponsive();
  const { projects, load, loading, error } = useProjects();
  const [search, setSearch] = useState("");
  useFocusEffect(
    useCallback(() => {
      void load(repo);
    }, [repo, load]),
  );
  const visible = projects.filter((p) =>
    `${p.name} ${p.customer} ${p.city} ${p.district}`
      .toLocaleLowerCase("tr-TR")
      .includes(search.toLocaleLowerCase("tr-TR")),
  );
  return (
    <Page
      title={
        cutting
          ? "Profil kesim planları"
          : framing
            ? "Karkas planları"
            : drawing
              ? "Çizim çalışma alanı"
              : "Projelerim"
      }
      subtitle={
        cutting
          ? "Kesim planı oluşturmak veya açmak için proje seçin."
          : framing
            ? "Karkas oluşturmak veya açmak için proje seçin."
            : drawing
              ? "Çizimine devam etmek için bir proje seçin."
              : `${projects.length} proje · Bu cihazda saklanıyor`
      }
      action={
        <Button
          title="Yeni"
          icon={Plus}
          onPress={() => router.push("/project/new")}
        />
      }
    >
      <Field
        label="Proje ara"
        placeholder="Proje, müşteri veya konum"
        value={search}
        onChangeText={setSearch}
      />
      {error ? (
        <StateView
          title="Projeler yüklenemedi"
          description={error}
          action={
            <Button title="Tekrar dene" onPress={() => void load(repo)} />
          }
        />
      ) : loading && !projects.length ? (
        <StateView title="Projeler yükleniyor" loading />
      ) : !visible.length ? (
        <StateView
          title={search ? "Eşleşen proje yok" : "Henüz proje yok"}
          description={
            search
              ? "Başka bir arama deneyin."
              : "Çizimlerinizi saklamak için ilk projenizi oluşturun."
          }
          action={
            !search ? (
              <Button
                title="Proje oluştur"
                onPress={() => router.push("/project/new")}
              />
            ) : undefined
          }
        />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {visible.map((p) => (
            <View key={p.id} style={{ width: tablet ? "48%" : "100%", gap: 8 }}>
              <ProjectCard project={p} />
              {cutting && (
                <Button
                  title={`${p.name} · Kesim planı`}
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/cutting/[id]",
                      params: { id: p.id },
                    })
                  }
                />
              )}
              {framing && (
                <Button
                  title={`${p.name} · Karkas planı`}
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/framing/[id]",
                      params: { id: p.id },
                    })
                  }
                />
              )}
              {drawing && (
                <Button
                  title={`${p.name} · Çizimi aç`}
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/drawing/[id]",
                      params: { id: p.id },
                    })
                  }
                />
              )}
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}

import { useEffect, useState } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from "react-native";
import { router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { Save, PenTool, Trash2, Layers } from "lucide-react-native";
import { Page, Field, Button, Label, Card, StateView } from "../components/ui";
import { useRepository } from "../core/db/provider";
import { errorMessage, useProjects } from "../core/store/projects";
import { useTheme, useResponsive } from "../core/theme/theme";
import { projectTypes, type ProjectInput } from "../modules/projects/model";
const initial: ProjectInput = {
  name: "",
  customer: "",
  city: "",
  district: "",
  description: "",
  type: "Deck",
};
export default function ProjectFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const editing = id !== "new";
  const repo = useRepository();
  const { colors } = useTheme();
  const { tablet } = useResponsive();
  const [form, setForm] = useState<ProjectInput>(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!editing) return;
    let active = true;
    setLoading(true);
    setLoadError(null);
    void repo
      .get(id)
      .then((p) => {
        if (!active) return;
        if (!p) throw new Error("Proje bulunamadı.");
        const next: ProjectInput = {
          name: p.name,
          customer: p.customer,
          city: p.city,
          district: p.district,
          description: p.description,
          type: p.type,
        };
        setForm(next);
        setBaseline(JSON.stringify(next));
      })
      .catch((e) => {
        if (active) setLoadError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, editing, repo, attempt]);
  const dirty = JSON.stringify(form) !== baseline;
  const disablePrevention = usePreventRemove(dirty || busy, ({ repeat }) => {
    if (busy) {
      Alert.alert("İşlem sürüyor", "Lütfen işlemin tamamlanmasını bekleyin.");
      return;
    }
    Alert.alert(
      "Değişiklikler kaydedilmedi",
      "Kaydetmeden çıkmak istiyor musunuz?",
      [
        { text: "Düzenlemeye devam", style: "cancel" },
        {
          text: "Değişiklikleri bırak",
          style: "destructive",
          onPress: () => {
            setBaseline(JSON.stringify(form));
            repeat();
          },
        },
      ],
    );
  });
  const update = <K extends keyof ProjectInput>(
    key: K,
    value: ProjectInput[K],
  ) => {
    setForm((p) => ({ ...p, [key]: value }));
    setError(null);
  };
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const p = await repo.save(form, editing ? id : undefined);
      setBaseline(JSON.stringify(form));
      await useProjects.getState().load(repo);
      if (editing) Alert.alert("Kaydedildi", "Proje bilgileri güncellendi.");
      else {
        disablePrevention();
        router.replace({ pathname: "/project/[id]", params: { id: p.id } });
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function remove() {
    Alert.alert(
      "Proje silinsin mi?",
      "Bu proje ve çizimi kalıcı olarak silinecek.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Projeyi sil",
          style: "destructive",
          onPress: () => {
            setBusy(true);
            void repo
              .delete(id)
              .then(async () => {
                setBaseline(JSON.stringify(form));
                await useProjects.getState().load(repo);
                disablePrevention();
                router.replace("/projects");
              })
              .catch((e) => {
                setError(errorMessage(e));
                setBusy(false);
              });
          },
        },
      ],
    );
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page
        title={editing ? "Proje detayları" : "Yeni proje"}
        subtitle="Sağlam bir planın ilk adımı."
        back
      >
        {loading ? (
          <StateView title="Proje açılıyor" loading />
        ) : loadError ? (
          <StateView
            title="Proje açılamadı"
            description={loadError}
            action={
              <Button
                title="Tekrar dene"
                onPress={() => setAttempt((a) => a + 1)}
              />
            }
          />
        ) : (
          <>
            <Card>
              <Label
                style={{
                  color: colors.accent,
                  fontSize: 11,
                  letterSpacing: 1.3,
                }}
              >
                PROJE BİLGİLERİ
              </Label>
              <Field
                label="Proje adı *"
                placeholder="Örn. Urla bahçe terası"
                maxLength={120}
                value={form.name}
                onChangeText={(v) => update("name", v)}
                editable={!busy}
              />
              <Field
                label="Müşteri adı"
                placeholder="Opsiyonel"
                maxLength={120}
                value={form.customer}
                onChangeText={(v) => update("customer", v)}
                editable={!busy}
              />
              <View
                style={{ flexDirection: tablet ? "row" : "column", gap: 14 }}
              >
                <View style={{ flex: 1 }}>
                  <Field
                    label="İl *"
                    placeholder="Örn. İzmir"
                    maxLength={80}
                    value={form.city}
                    onChangeText={(v) => update("city", v)}
                    editable={!busy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="İlçe *"
                    placeholder="Örn. Urla"
                    maxLength={80}
                    value={form.district}
                    onChangeText={(v) => update("district", v)}
                    editable={!busy}
                  />
                </View>
              </View>
              <Label style={{ fontWeight: "600" }}>Proje türü</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {projectTypes.map((type) => (
                  <Pressable
                    key={type}
                    disabled={busy}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: form.type === type }}
                    onPress={() => update("type", type)}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 18,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor:
                        form.type === type ? colors.accent : colors.raised,
                    }}
                  >
                    <Label
                      style={{
                        color:
                          form.type === type ? colors.accentText : colors.text,
                        fontWeight: "600",
                      }}
                    >
                      {type}
                    </Label>
                  </Pressable>
                ))}
              </View>
              <Field
                label="Proje açıklaması"
                placeholder="Uygulama alanı ve proje notları…"
                multiline
                maxLength={2000}
                numberOfLines={4}
                style={{ minHeight: 100 }}
                value={form.description}
                onChangeText={(v) => update("description", v)}
                editable={!busy}
              />
            </Card>
            {error && (
              <Label style={{ color: colors.danger }} accessibilityRole="alert">
                {error}
              </Label>
            )}
            <Button
              title={editing ? "Değişiklikleri kaydet" : "Projeyi oluştur"}
              icon={Save}
              loading={busy}
              onPress={() => void save()}
            />
            {editing && (
              <>
                <Button
                  title="Çizim çalışma alanını aç"
                  icon={PenTool}
                  variant="secondary"
                  disabled={busy || dirty}
                  onPress={() =>
                    router.push({ pathname: "/drawing/[id]", params: { id } })
                  }
                />
                <Button
                  title="Karkas planını aç"
                  icon={Layers}
                  variant="secondary"
                  disabled={busy || dirty}
                  onPress={() =>
                    router.push({ pathname: "/framing/[id]", params: { id } })
                  }
                />
                {dirty && (
                  <Label muted>
                    Çizimi açmadan önce proje bilgilerini kaydedin.
                  </Label>
                )}
                <Button
                  title="Projeyi sil"
                  icon={Trash2}
                  variant="danger"
                  disabled={busy}
                  onPress={remove}
                />
              </>
            )}
            <Label muted style={{ fontSize: 12 }}>
              * Zorunlu alanlar. Veriler bu cihazdaki SQLite veritabanına
              kaydedilir.
            </Label>
          </>
        )}
      </Page>
    </KeyboardAvoidingView>
  );
}

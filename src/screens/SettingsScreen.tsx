import { useState } from "react";
import { View, Pressable } from "react-native";
import { Moon, Sun, Monitor, HardDrive } from "lucide-react-native";
import { Page, Label, Card } from "../components/ui";
import { useTheme } from "../core/theme/theme";
import {
  usePreferences,
  type ThemePreference,
} from "../core/store/preferences";
import { useRepository } from "../core/db/provider";
import { errorMessage } from "../core/store/projects";
export default function SettingsScreen() {
  const { colors } = useTheme();
  const repo = useRepository();
  const { theme, setTheme } = usePreferences();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function choose(value: ThemePreference) {
    setBusy(true);
    setError("");
    try {
      await repo.setSetting("theme", value);
      setTheme(value);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title="Ayarlar"
      subtitle="Çalışma alanınızı kendinize göre düzenleyin."
    >
      <Card>
        <Label style={{ fontSize: 17, fontWeight: "600" }}>Görünüm</Label>
        {(
          [
            { id: "dark", title: "Koyu", icon: Moon },
            { id: "light", title: "Açık", icon: Sun },
            { id: "system", title: "Sistem", icon: Monitor },
          ] as const
        ).map(({ id, title, icon: Icon }) => (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ checked: theme === id }}
            disabled={busy}
            onPress={() => void choose(id)}
            style={{
              minHeight: 50,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: 10,
              backgroundColor: theme === id ? colors.raised : "transparent",
            }}
          >
            <Icon
              size={20}
              color={theme === id ? colors.accent : colors.muted}
            />
            <Label style={{ flex: 1 }}>{title}</Label>
            {theme === id && (
              <Label style={{ color: colors.accent }}>Seçili</Label>
            )}
          </Pressable>
        ))}
        {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
      </Card>
      <Card>
        <HardDrive color={colors.accent} size={22} />
        <Label style={{ fontSize: 17, fontWeight: "600" }}>
          Verileriniz bu cihazda
        </Label>
        <Label muted>
          Projeler ve çizimler çevrimdışı saklanır. Uygulama silinirse yerel
          veriler de silinebilir. Bulut eşitleme ve hesap sistemi bu sürümde
          bulunmuyor.
        </Label>
      </Card>
      <Card>
        <Label style={{ fontWeight: "700" }}>DeckAft Studio</Label>
        <Label muted>0.1.0 · FAZ 00</Label>
        <Label muted>
          Proje yönetimi ve çizim altyapısı. Karkas, kesim optimizasyonu, parsel
          sorgulama ve PDF modülleri hazırlık aşamasında.
        </Label>
      </Card>
    </Page>
  );
}

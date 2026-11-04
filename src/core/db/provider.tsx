import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { openDatabaseAsync } from "expo-sqlite";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { APP } from "../config";
import { ProjectRepository } from "./repository";
import { usePreferences } from "../store/preferences";
import { errorMessage } from "../store/projects";
const RepositoryContext = createContext<ProjectRepository | null>(null);
let connection: Promise<ProjectRepository> | null = null;
async function connect() {
  if (!connection)
    connection = (async () => {
      const db = await openDatabaseAsync(APP.database);
      const repo = new ProjectRepository(db);
      try {
        await repo.init();
        return repo;
      } catch (e) {
        await db.closeAsync();
        throw e;
      }
    })().catch((e) => {
      connection = null;
      throw e;
    });
  return connection;
}
export function DatabaseProvider({ children }: PropsWithChildren) {
  const [repo, setRepo] = useState<ProjectRepository | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void connect()
      .then(async (r) => {
        const theme = await r.getSetting("theme");
        if (!active) return;
        if (theme === "dark" || theme === "light" || theme === "system")
          usePreferences.getState().setTheme(theme);
        setRepo(r);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (!repo)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#101317",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          gap: 20,
        }}
      >
        <Text style={{ color: "#E8B547", fontSize: 26, fontWeight: "700" }}>
          DeckAft Studio
        </Text>
        {error ? (
          <>
            <Text style={{ color: "#FFFFFF", textAlign: "center" }}>
              Yerel depolama açılamadı: {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAttempt((a) => a + 1)}
              style={{
                padding: 16,
                backgroundColor: "#E8B547",
                borderRadius: 12,
              }}
            >
              <Text>Tekrar dene</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator
            color="#E8B547"
            accessibilityLabel="Veritabanı hazırlanıyor"
          />
        )}
      </View>
    );
  return (
    <RepositoryContext.Provider value={repo}>
      {children}
    </RepositoryContext.Provider>
  );
}
export function useRepository() {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error("DatabaseProvider eksik.");
  return repo;
}

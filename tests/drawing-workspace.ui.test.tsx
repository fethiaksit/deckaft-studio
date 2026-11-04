import { beforeEach, afterEach, test, expect, jest } from "@jest/globals";
import { DatabaseSync } from "node:sqlite";
import {
  act,
  fireEvent,
  renderHook,
  render,
  waitFor,
  screen,
} from "@testing-library/react-native";
import { ProjectRepository, type SqlDatabase } from "../src/core/db/repository";
import { useDrawingWorkspace } from "../src/modules/drawing/hooks/useDrawingWorkspace";
import DrawingScreen from "../src/screens/DrawingScreen";
import { SafeAreaProvider } from "react-native-safe-area-context";
let mockRepo: ProjectRepository;
let sqlite: DatabaseSync;
let mockProjectId: string;
let mockTablet = false;
jest.mock("../src/core/db/provider", () => ({ useRepository: () => mockRepo }));
jest.mock("expo-router", () => ({
  usePreventRemove: jest.fn(),
  useLocalSearchParams: () => ({ id: mockProjectId }),
  router: { canGoBack: () => false, replace: jest.fn() },
}));
jest.mock("../src/core/theme/theme", () => ({
  ...jest.requireActual<object>("../src/core/theme/theme"),
  useResponsive: () => ({
    tablet: mockTablet,
    width: mockTablet ? 1194 : 393,
    height: mockTablet ? 834 : 852,
    landscape: mockTablet,
  }),
}));
// Native GPU/gesture dispatch is a device concern; the real workspace/panels remain mounted.
jest.mock("../src/modules/drawing/components/DrawingCanvas", () => {
  const { View } = require("react-native");
  return { DrawingCanvas: () => <View testID="native-canvas-boundary" /> };
});
beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  const db: SqlDatabase = {
    execAsync: async (sql) => {
      sqlite.exec(sql);
    },
    runAsync: async (sql, ...params) => {
      const r = sqlite.prepare(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    getAllAsync: async <T,>(
      sql: string,
      ...params: (string | number | null)[]
    ) => sqlite.prepare(sql).all(...params) as T[],
  };
  mockRepo = new ProjectRepository(db);
  await mockRepo.init();
  mockProjectId = (
    await mockRepo.save({
      name: "Mobil test",
      customer: "",
      city: "İzmir",
      district: "Urla",
      description: "",
      type: "Deck",
    })
  ).id;
  mockTablet = false;
});
afterEach(() => sqlite.close());
const square = [
  { x: 0, y: 0 },
  { x: 10000, y: 0 },
  { x: 10000, y: 10000 },
  { x: 0, y: 10000 },
];
async function ready() {
  const h = await renderHook(() => useDrawingWorkspace(mockProjectId));
  await waitFor(() => expect(h.result.current.loading).toBe(false));
  return h;
}
async function outer(h: Awaited<ReturnType<typeof ready>>) {
  for (const p of square) await act(() => h.result.current.point(p, false));
  await act(() => h.result.current.close());
  expect(h.result.current.report.netM2).toBe(100);
}
test("workspace closes area, resizes a real edge, drags once, and undo/redo restores geometry", async () => {
  const h = await ready();
  await outer(h);
  await act(() => h.result.current.point({ x: 5000, y: 0 }));
  expect(h.result.current.selection?.kind).toBe("edge");
  await act(() => h.result.current.resize("12 m", "start"));
  expect(h.result.current.report.netM2).toBe(110);
  await act(() => h.result.current.historyStep("undo"));
  expect(h.result.current.report.netM2).toBe(100);
  await act(() => h.result.current.historyStep("redo"));
  expect(h.result.current.report.netM2).toBe(110);
  await act(() => h.result.current.changeTool("move"));
  const before = h.result.current.history.past.length;
  await act(() => h.result.current.dragStart({ x: 10000, y: 10000 }));
  await act(() => h.result.current.dragMove({ x: 9000, y: 9000 }));
  expect(h.result.current.report.netM2).toBeNull();
  await act(() => h.result.current.dragMove({ x: 8000, y: 8000 }));
  await act(() => h.result.current.dragEnd());
  expect(h.result.current.history.past.length).toBe(before + 1);
  expect(h.result.current.document.paths[0]?.points[2]).toEqual({
    x: 8000,
    y: 8000,
  });
  await act(() => h.result.current.historyStep("undo"));
  expect(h.result.current.report.netM2).toBe(110);
});
test("workspace void, layers, zoom and real SQLite save/reload retain coordinates and net result", async () => {
  const h = await ready();
  await outer(h);
  await act(() => h.result.current.newRegion("void", "Ev", "Ev"));
  for (const p of [
    { x: 1000, y: 1000 },
    { x: 3000, y: 1000 },
    { x: 3000, y: 3000 },
    { x: 1000, y: 3000 },
  ])
    await act(() => h.result.current.point(p, false));
  expect(h.result.current.report.netM2).toBeNull();
  await act(() => h.result.current.close());
  expect(h.result.current.report.netM2).toBe(96);
  await act(() =>
    h.result.current.updateSettings({
      layers: { ...h.result.current.document.layers, voids: false },
    }),
  );
  await act(() => h.result.current.setSize({ width: 393, height: 500 }));
  await act(() => h.result.current.fit());
  const old = h.result.current.viewport.scale;
  await act(() => h.result.current.zoom(1.25));
  expect(h.result.current.viewport.scale).toBeCloseTo(old * 1.25);
  expect(h.result.current.report.netM2).toBe(96);
  await act(() => h.result.current.save());
  expect(h.result.current.dirty).toBe(false);
  const snapshot = h.result.current.document;
  await h.unmount();
  const reopened = await ready();
  expect(reopened.result.current.document).toEqual(snapshot);
  expect(reopened.result.current.report.netM2).toBe(96);
});
test("undoing a newly created void never causes the next point to silently become a free line", async () => {
  const h = await ready();
  await outer(h);
  await act(() => h.result.current.newRegion("void", "Ev", "Ev"));
  await act(() => h.result.current.historyStep("undo"));
  await act(() => h.result.current.point({ x: 2000, y: 2000 }, false));
  expect(
    h.result.current.document.paths.filter((p) => p.role === "draft"),
  ).toHaveLength(0);
  expect(h.result.current.error).not.toBe("");
});
test.each([false, true])(
  "phone/tablet layout mounts appropriate toolbar and properties (tablet=%s)",
  async (tablet) => {
    mockTablet = tablet;
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: {
            x: 0,
            y: 0,
            width: tablet ? 1194 : 393,
            height: tablet ? 834 : 852,
          },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <DrawingScreen />
      </SafeAreaProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("native-canvas-boundary")).toBeTruthy(),
    );
    expect(screen.getByLabelText("Çizimi ortala")).toBeTruthy();
    if (tablet) {
      expect(screen.getByText("Katmanlar")).toBeTruthy();
      expect(screen.queryByLabelText("Ölçüler ve özellikler")).toBeNull();
    } else {
      expect(screen.getByLabelText("Ölçüler ve özellikler")).toBeTruthy();
      expect(screen.queryByText("Katmanlar")).toBeNull();
    }
  },
);

test("phone controls create a measured polygon and save via real repository", async () => {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 852 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <DrawingScreen />
    </SafeAreaProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("native-canvas-boundary")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByLabelText("Ölçüler ve özellikler"));
  await fireEvent.press(
    screen.getByRole("button", { name: "Dış alanı başlat" }),
  );
  for (const p of square) {
    await fireEvent.changeText(screen.getByLabelText("X (mm)"), String(p.x));
    await fireEvent.changeText(screen.getByLabelText("Y (mm)"), String(p.y));
    await fireEvent.press(screen.getByRole("button", { name: "Nokta ekle" }));
  }
  await fireEvent.press(
    screen.getAllByRole("button", { name: "Alanı kapat" })[0]!,
  );
  expect(screen.getAllByText("Net 100,00 m²").length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole("button", { name: "Kaydet" }));
  await waitFor(() =>
    expect(screen.getByText("Çizim kaydedildi")).toBeTruthy(),
  );
  expect((await mockRepo.getDrawing(mockProjectId)).paths[0]?.points).toEqual(
    square,
  );
});

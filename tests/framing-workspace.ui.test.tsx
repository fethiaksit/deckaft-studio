import { beforeEach, afterEach, test, expect, jest } from "@jest/globals";
import { DatabaseSync } from "node:sqlite";
import {
  act,
  renderHook,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProjectRepository, type SqlDatabase } from "../src/core/db/repository";
import {
  emptyDrawing,
  type DrawingDocument,
} from "../src/modules/drawing/model";
import { useFramingWorkspace } from "../src/modules/framing/hooks/useFramingWorkspace";
import FramingScreen from "../src/screens/FramingScreen";
let mockRepo: ProjectRepository;
let sqlite: DatabaseSync;
let mockProjectId: string;
let mockTablet = false;
jest.mock("../src/core/db/provider", () => ({ useRepository: () => mockRepo }));
jest.mock("expo-router", () => ({
  usePreventRemove: jest.fn(),
  useLocalSearchParams: () => ({ id: mockProjectId }),
  router: { canGoBack: () => false, replace: jest.fn() },
  useFocusEffect: (callback: () => void) =>
    require("react").useEffect(callback, [callback]),
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
jest.mock("../src/modules/framing/components/FramingCanvas", () => {
  const { View } = require("react-native");
  return { FramingCanvas: () => <View testID="framing-canvas-boundary" /> };
});
const doc: DrawingDocument = {
  ...emptyDrawing(),
  paths: [
    {
      id: "outer",
      name: "Deck",
      role: "outer",
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: 4000 },
        { x: 0, y: 4000 },
      ],
    },
  ],
};
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
      name: "Karkas test",
      city: "İzmir",
      district: "Urla",
      customer: "",
      description: "",
      type: "Deck",
    })
  ).id;
  await mockRepo.saveDrawing(mockProjectId, doc);
  mockTablet = false;
});
afterEach(() => sqlite.close());
async function ready() {
  const h = await renderHook(() => useFramingWorkspace(mockProjectId));
  await waitFor(() => expect(h.result.current.loading).toBe(false));
  return h;
}
test("framing workspace generates, edits, undo/redoes, saves and reopens exact real profiles", async () => {
  const h = await ready();
  await act(() => h.result.current.generate());
  expect(h.result.current.plan?.members.length).toBeGreaterThan(0);
  expect(h.result.current.plan?.technicalStatus).toBe("requires-approval");
  expect(
    h.result.current.plan?.warnings.some(
      (w) => w.code === "DECK_LAYOUT_INCOMPLETE",
    ),
  ).toBe(true);
  const m = h.result.current.plan!.members.find(
    (m) => m.layer === "upper" && m.start.x > 1000,
  )!;
  const initial = h.result.current.totals!.totalLengthMm;
  await act(() => h.result.current.select(m.id));
  await act(() => h.result.current.deleteSelected());
  expect(h.result.current.totals!.totalLengthMm).toBeCloseTo(
    initial - m.lengthMm,
  );
  await act(() => h.result.current.historyStep("undo"));
  expect(h.result.current.totals!.totalLengthMm).toBe(initial);
  await act(() => h.result.current.historyStep("redo"));
  expect(h.result.current.totals!.totalLengthMm).toBeCloseTo(
    initial - m.lengthMm,
  );
  await act(() => h.result.current.save());
  expect(h.result.current.dirty).toBe(false);
  const snapshot = h.result.current.plan;
  await h.unmount();
  const next = await ready();
  expect(next.result.current.plan).toEqual(snapshot);
});
test("changed drawing blocks old framing save and regeneration restores exact source linkage", async () => {
  const h = await ready();
  await act(() => h.result.current.generate());
  await act(() => h.result.current.save());
  await h.unmount();
  await mockRepo.saveDrawing(mockProjectId, {
    ...doc,
    paths: doc.paths.map((p) => ({
      ...p,
      points: p.points.map((v, i) => (i === 1 ? { x: 6500, y: 0 } : v)),
    })),
  });
  const next = await ready();
  expect(next.result.current.stale).toBe(true);
  await act(() => next.result.current.save());
  expect(next.result.current.error).toMatch(/yeniden|değişti/i);
  await act(() => next.result.current.generate());
  expect(next.result.current.stale).toBe(false);
});
test.each([false, true])(
  "phone/tablet screen exposes real generation/save controls and preapproval state (tablet=%s)",
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
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}
      >
        <FramingScreen />
      </SafeAreaProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("framing-canvas-boundary")).toBeTruthy(),
    );
    await fireEvent.press(
      screen.getAllByRole("button", { name: "Karkas Oluştur" })[0]!,
    );
    expect(screen.getAllByText(/Ön Yerleşim/).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() =>
      expect(screen.getByText("Karkas kaydedildi")).toBeTruthy(),
    );
    expect(
      (await mockRepo.getFraming(mockProjectId))?.members.length,
    ).toBeGreaterThan(0);
  },
);

test("profile drag commits last motion once even when events share a React batch", async () => {
  const h = await ready();
  await act(() => h.result.current.generate());
  const m = h.result.current.plan!.members.find(
    (m) => m.layer === "upper" && m.start.x > 1000 && m.start.x < 4000,
  )!;
  const at = { x: m.start.x, y: (m.start.y + m.end.y) / 2 };
  const past = h.result.current.history.past.length;
  await act(() => {
    h.result.current.dragStart(at);
    h.result.current.dragMove({ x: at.x + 10, y: at.y });
    h.result.current.dragEnd();
  });
  expect(
    h.result.current.plan!.members.find((q) => q.id === m.id)?.start.x,
  ).toBe(m.start.x + 10);
  expect(h.result.current.history.past.length).toBe(past + 1);
});

test("unapplied settings survive hiding and reopening the phone panel", async () => {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 852 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <FramingScreen />
    </SafeAreaProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("framing-canvas-boundary")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByLabelText("Karkas ayar paneli"));
  await fireEvent.changeText(
    screen.getByLabelText("Tahta genişliği (mm)"),
    "145",
  );
  await fireEvent.press(screen.getByLabelText("Karkas panelini gizle"));
  await fireEvent.press(screen.getByLabelText("Karkas ayar paneli"));
  expect(screen.getByLabelText("Tahta genişliği (mm)").props.value).toBe("145");
});

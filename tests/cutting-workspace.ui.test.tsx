import { beforeEach, afterEach, test, expect, jest } from "@jest/globals";
import { DatabaseSync } from "node:sqlite";
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProjectRepository, type SqlDatabase } from "../src/core/db/repository";
import { emptyDrawing } from "../src/modules/drawing/model";
import { sourceGeometrySignature } from "../src/modules/framing/engine";
import { member, plan } from "./cutting-fixtures";
import { useCuttingWorkspace } from "../src/modules/cutting/hooks/useCuttingWorkspace";
import CuttingScreen from "../src/screens/CuttingScreen";
import { router } from "expo-router";
let mockRepo: ProjectRepository, sqlite: DatabaseSync, mockProjectId: string;
let mockTablet = false;
jest.mock("../src/core/db/provider", () => ({ useRepository: () => mockRepo }));
jest.mock("expo-router", () => ({
  usePreventRemove: jest.fn(),
  useLocalSearchParams: () => ({ id: mockProjectId }),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  },
  useFocusEffect: (callback: () => void) =>
    require("react").useEffect(callback, [callback]),
}));
jest.mock("../src/core/theme/theme", () => ({
  ...jest.requireActual<object>("../src/core/theme/theme"),
  useResponsive: () => ({
    tablet: mockTablet,
    width: mockTablet ? 1194 : 393,
    height: mockTablet ? 834 : 852,
  }),
}));
beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  const db: SqlDatabase = {
    execAsync: async (s) => {
      sqlite.exec(s);
    },
    runAsync: async (s, ...args) => ({
      changes: Number(sqlite.prepare(s).run(...args).changes),
    }),
    getAllAsync: async <T,>(s: string, ...args: (string | number | null)[]) =>
      sqlite.prepare(s).all(...args) as T[],
  };
  mockRepo = new ProjectRepository(db);
  await mockRepo.init();
  mockProjectId = (
    await mockRepo.save({
      name: "Kesim test",
      city: "İzmir",
      district: "Urla",
      customer: "",
      description: "",
      type: "Deck",
    })
  ).id;
  const d = emptyDrawing();
  await mockRepo.saveDrawing(mockProjectId, d);
  await mockRepo.saveFraming({
    ...plan([
      member("U-014", 2450),
      member("U-021", 1800),
      member("A-003", 1700),
      member("long", 7200),
    ]),
    projectId: mockProjectId,
    sourceGeometry: sourceGeometrySignature(d),
  });
  mockTablet = false;
});
afterEach(() => sqlite.close());
async function ready() {
  const h = await renderHook(() => useCuttingWorkspace(mockProjectId));
  await waitFor(() => expect(h.result.current.loading).toBe(false));
  return h;
}
test("workspace generates, saves and reloads a source linked cutting plan; edits block save", async () => {
  const h = await ready();
  await act(() => h.result.current.generate());
  expect(h.result.current.plan?.totalWasteMm).toBe(50);
  expect(h.result.current.plan?.stocks.length).toBe(1);
  await act(() => h.result.current.save());
  expect(h.result.current.dirty).toBe(false);
  await h.unmount();
  const reopened = await ready();
  expect(reopened.result.current.plan?.stocks.length).toBe(1);
  await act(() => reopened.result.current.setField("minReusableMm", "10"));
  expect(reopened.result.current.settingsDirty).toBe(true);
  await act(() => reopened.result.current.save());
  expect(reopened.result.current.error).toMatch(/yeniden|değiş/i);
  await act(() => reopened.result.current.generate());
  expect(reopened.result.current.plan?.totalWasteMm).toBe(9);
});
test.each([false, true])(
  "phone/tablet (%s) cutting bars expose pieces, exclusions and highlighted source link",
  async (tablet) => {
    mockTablet = tablet;
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 1194, height: 834 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}
      >
        <CuttingScreen />
      </SafeAreaProvider>,
    );
    await screen.findByText("Kesim planını oluştur");
    await fireEvent.press(screen.getByText("Kesim planını oluştur"));
    await screen.findByText("Optimal çözüm kanıtlandı", {}, { timeout: 5000 });
    expect(
      screen.getByTestId(
        tablet ? "cutting-tablet-layout" : "cutting-phone-layout",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Kısmi hesap · 1 profil hariç")).toBeTruthy();
    expect(screen.getByText(/long ·/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "U-014, 245 cm, S-001" }),
    );
    if (!tablet)
      expect(screen.getByText("Parça ayrıntısını kapat")).toBeTruthy();
    expect(screen.getByText("Seçili profil: U-014")).toBeTruthy();
    expect(screen.getByText("Üst karkas · S-001")).toBeTruthy();
    await fireEvent.press(screen.getByText("Karkasta vurgula"));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/framing/[id]",
        params: { id: mockProjectId, memberId: "U-014" },
      }),
    );
    expect((await mockRepo.getCutting(mockProjectId))?.stocks.length).toBe(1);
  },
  15000,
);
test("changed framing while screen is open blocks save and marks plan stale", async () => {
  const h = await ready();
  await act(() => h.result.current.generate());
  const source = (await mockRepo.getFraming(mockProjectId))!;
  await mockRepo.saveFraming({ ...source, members: [member("U-014", 2000)] });
  await act(() => h.result.current.save());
  expect(h.result.current.plan?.stale).toBe(true);
  expect(h.result.current.error).toMatch(/değiş/);
});
test("invalid settings do not reuse old result and unsaved changes remain guarded", async () => {
  const h = await ready();
  await act(() => h.result.current.generate());
  await act(() => h.result.current.setField("cutKerfMm", "-3"));
  await act(() => h.result.current.generate());
  expect(h.result.current.error).toMatch(/Geçersiz/);
  expect(h.result.current.settingsDirty).toBe(true);
});

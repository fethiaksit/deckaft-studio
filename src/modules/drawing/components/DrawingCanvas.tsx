import { useMemo, useRef } from "react";
import { View, Text } from "react-native";
import {
  Canvas,
  Line,
  Circle,
  Path,
  Skia,
  DashPathEffect,
} from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { useTheme } from "../../../core/theme/theme";
import { worldToScreen, screenToWorld, zoomAt } from "../coordinates";
import { pathVisible } from "../operations";
import { length } from "../../geometry/engine";
import type { DrawingWorkspace } from "../hooks/useDrawingWorkspace";
export function DrawingCanvas({
  workspace: w,
}: {
  workspace: DrawingWorkspace;
}) {
  const { colors } = useTheme();
  const latest = useRef(w);
  latest.current = w;
  const panOrigin = useSharedValue({ x: 0, y: 0 });
  const pinchOrigin = useSharedValue(w.viewport);
  const pinchFocal = useSharedValue({ x: 0, y: 0 });
  const gestures = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDuration(400)
      .maxDistance(9)
      .runOnJS(true)
      .onEnd((e, success) => {
        if (success && latest.current.tool !== "pan")
          latest.current.point(
            screenToWorld({ x: e.x, y: e.y }, latest.current.viewport),
          );
      });
    const drag = Gesture.Pan()
      .enabled(w.tool === "move")
      .minPointers(1)
      .maxPointers(1)
      .minDistance(3)
      .runOnJS(true)
      .onStart((e) =>
        latest.current.dragStart(
          screenToWorld({ x: e.x, y: e.y }, latest.current.viewport),
        ),
      )
      .onUpdate((e) => {
        if (e.numberOfPointers !== 1) {
          latest.current.dragEnd(true);
          return;
        }
        latest.current.dragMove(
          screenToWorld({ x: e.x, y: e.y }, latest.current.viewport),
        );
      })
      .onEnd((_, success) => latest.current.dragEnd(!success))
      .onFinalize((_, success) => {
        if (!success) latest.current.dragEnd(true);
      });
    const pan = Gesture.Pan()
      .minPointers(w.tool === "pan" ? 1 : 2)
      .maxPointers(w.tool === "pan" ? 1 : 2)
      .minDistance(4)
      .runOnJS(true)
      .onStart(() => {
        panOrigin.value = {
          x: latest.current.viewport.x,
          y: latest.current.viewport.y,
        };
      })
      .onUpdate((e) =>
        latest.current.setViewport({
          ...latest.current.viewport,
          x: panOrigin.value.x + e.translationX,
          y: panOrigin.value.y + e.translationY,
        }),
      );
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart((e) => {
        pinchOrigin.value = latest.current.viewport;
        pinchFocal.value = { x: e.focalX, y: e.focalY };
      })
      .onUpdate((e) => {
        const v = zoomAt(pinchOrigin.value, pinchFocal.value, e.scale);
        latest.current.setViewport({
          ...v,
          x: v.x + e.focalX - pinchFocal.value.x,
          y: v.y + e.focalY - pinchFocal.value.y,
        });
      });
    return Gesture.Race(pinch, drag, pan, tap);
  }, [w.tool, panOrigin, pinchOrigin, pinchFocal]);
  const d = w.displayDocument,
    v = w.viewport,
    { width, height } = w.size;
  const paths = d.paths.filter((p) => pathVisible(d, p));
  const spacing =
    d.snap.gridMm *
    Math.max(
      1,
      Math.pow(10, Math.ceil(Math.log10(30 / (d.snap.gridMm * v.scale)))),
    );
  const step = spacing * v.scale;
  const grid = [];
  if (d.layers.grid && width && height) {
    const x0 = ((v.x % step) + step) % step,
      y0 = ((v.y % step) + step) % step;
    for (let x = x0; x < width; x += step)
      grid.push(
        <Line
          key={`x${x}`}
          p1={{ x, y: 0 }}
          p2={{ x, y: height }}
          color={colors.grid}
          strokeWidth={0.6}
        />,
      );
    for (let y = y0; y < height; y += step)
      grid.push(
        <Line
          key={`y${y}`}
          p1={{ x: 0, y }}
          p2={{ x: width, y }}
          color={colors.grid}
          strokeWidth={0.6}
        />,
      );
  }
  const labels: {
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
  }[] = [];
  if (d.layers.dimensions) {
    for (const p of paths) {
      const count = p.closed ? p.points.length : p.points.length - 1;
      for (let i = 0; i < count; i++) {
        const a = p.points[i]!,
          b = p.points[(i + 1) % p.points.length]!,
          sa = worldToScreen(a, v),
          sb = worldToScreen(b, v);
        if (Math.hypot(sb.x - sa.x, sb.y - sa.y) < 42) continue;
        labels.push({
          id: `${p.id}-${i}`,
          text: `${(length(a, b) / 1000).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`,
          x: (sa.x + sb.x) / 2,
          y: (sa.y + sb.y) / 2 - 19,
          color: p.role === "void" ? colors.accent : colors.text,
        });
      }
    }
    for (const m of d.dimensions) {
      const a = worldToScreen(m.from, v),
        b = worldToScreen(m.to, v);
      labels.push({
        id: m.id,
        text: `${m.lengthMm.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} mm`,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2 - 20,
        color: colors.accent,
      });
    }
  }
  const selected = w.selection;
  const selectedPath =
    selected && selected.kind !== "dimension"
      ? d.paths.find((p) => p.id === selected.pathId)
      : null;
  const selectedEdge =
    selected?.kind === "edge" && selectedPath
      ? {
          a: selectedPath.points[selected.index],
          b: selectedPath.points[
            (selected.index + 1) % selectedPath.points.length
          ],
        }
      : null;
  return (
    <View
      style={{ flex: 1, backgroundColor: colors.canvas }}
      onLayout={(e) =>
        w.setSize({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }
    >
      <GestureDetector gesture={gestures}>
        <View
          collapsable={false}
          style={{ flex: 1 }}
          accessibilityLabel="Akıllı milimetre çizim yüzeyi"
        >
          <Canvas style={{ flex: 1 }}>
            {grid}
            {d.layers.grid && (
              <>
                <Line
                  p1={{ x: v.x, y: 0 }}
                  p2={{ x: v.x, y: height }}
                  color={colors.muted}
                  opacity={0.35}
                  strokeWidth={1}
                />
                <Line
                  p1={{ x: 0, y: v.y }}
                  p2={{ x: width, y: v.y }}
                  color={colors.muted}
                  opacity={0.35}
                  strokeWidth={1}
                />
              </>
            )}
            {paths
              .filter((p) => p.role === "outer" && p.closed)
              .map((p) => (
                <Path
                  key={`fill${p.id}`}
                  path={Skia.Path.Polygon(
                    p.points.map((p) => worldToScreen(p, v)),
                    true,
                  )}
                  style="fill"
                  color={colors.accent}
                  opacity={0.09}
                />
              ))}
            {paths
              .filter((p) => p.role === "void" && p.closed)
              .map((p) => (
                <Path
                  key={`fill${p.id}`}
                  path={Skia.Path.Polygon(
                    p.points.map((p) => worldToScreen(p, v)),
                    true,
                  )}
                  style="fill"
                  color={colors.canvas}
                />
              ))}
            {paths.map((p) => (
              <Path
                key={p.id}
                path={Skia.Path.Polygon(
                  p.points.map((p) => worldToScreen(p, v)),
                  p.closed,
                )}
                style="stroke"
                strokeWidth={w.activePath?.id === p.id ? 2.4 : 1.7}
                color={p.role === "void" ? colors.accent : colors.text}
                strokeJoin="round"
                strokeCap="round"
              >
                {p.role === "void" && <DashPathEffect intervals={[6, 4]} />}
              </Path>
            ))}
            {selectedEdge?.a && selectedEdge.b && (
              <Line
                p1={worldToScreen(selectedEdge.a, v)}
                p2={worldToScreen(selectedEdge.b, v)}
                color={colors.accent}
                strokeWidth={5}
              />
            )}
            {paths.flatMap((p) =>
              p.points.map((point, i) => {
                const pos = worldToScreen(point, v);
                const active =
                  selected?.kind === "vertex" &&
                  selected.pathId === p.id &&
                  selected.index === i;
                return (
                  <Circle
                    key={`${p.id}-${i}`}
                    cx={pos.x}
                    cy={pos.y}
                    r={active ? 7 : 4}
                    color={active ? colors.text : colors.accent}
                  />
                );
              }),
            )}
            {d.layers.dimensions &&
              d.dimensions.map((m) => (
                <Line
                  key={m.id}
                  p1={worldToScreen(m.from, v)}
                  p2={worldToScreen(m.to, v)}
                  color={
                    selected?.kind === "dimension" && selected.id === m.id
                      ? colors.text
                      : colors.accent
                  }
                  strokeWidth={1.4}
                />
              ))}
            {w.measureStart && d.layers.dimensions && (
              <Circle
                c={worldToScreen(w.measureStart, v)}
                r={6}
                color={colors.accent}
              />
            )}
            {d.layers.grid && w.hint?.kind && (
              <>
                <Line
                  p1={{ x: 0, y: worldToScreen(w.hint.point, v).y }}
                  p2={{ x: width, y: worldToScreen(w.hint.point, v).y }}
                  color={colors.accent}
                  opacity={0.35}
                  strokeWidth={1}
                />
                <Line
                  p1={{ x: worldToScreen(w.hint.point, v).x, y: 0 }}
                  p2={{ x: worldToScreen(w.hint.point, v).x, y: height }}
                  color={colors.accent}
                  opacity={0.35}
                  strokeWidth={1}
                />
              </>
            )}
          </Canvas>
        </View>
      </GestureDetector>
      {labels
        .filter(
          (l) => l.x >= 0 && l.y >= 0 && l.x < width - 50 && l.y < height - 20,
        )
        .map((l) => (
          <Text
            key={l.id}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: l.x,
              top: l.y,
              color: l.color,
              backgroundColor: colors.canvas,
              fontSize: 10,
              padding: 2,
            }}
          >
            {l.text}
          </Text>
        ))}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          backgroundColor: colors.surface,
          padding: 6,
          borderRadius: 6,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 10 }}>
          {d.layers.grid
            ? `Izgara ${spacing.toLocaleString("tr-TR")} mm · `
            : ""}
          {Math.round(v.scale * 1000)} px / m
        </Text>
      </View>
    </View>
  );
}

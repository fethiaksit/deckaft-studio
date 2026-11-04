import { useMemo, useRef, useState } from "react";
import { View, Text } from "react-native";
import { Canvas, Line, Circle, Path, Skia } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import type { DrawingDocument, DrawingTool } from "../model";
import {
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Viewport,
} from "../coordinates";
import type { PointMm } from "../../geometry/model";
import { useTheme } from "../../../core/theme/theme";
interface Props {
  document: DrawingDocument;
  viewport: Viewport;
  onViewport: (v: Viewport) => void;
  tool: DrawingTool;
  onPoint: (p: PointMm) => void;
  selectedId: string | null;
  measureStart: PointMm | null;
  grid: boolean;
}
export function DrawingCanvas({
  document,
  viewport,
  onViewport,
  tool,
  onPoint,
  selectedId,
  measureStart,
  grid,
}: Props) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const latest = useRef({ viewport, onViewport, onPoint });
  latest.current = { viewport, onViewport, onPoint };
  const panOrigin = useSharedValue({ x: 0, y: 0 });
  const pinchOrigin = useSharedValue(viewport);
  const pinchFocal = useSharedValue({ x: 0, y: 0 });
  const gestures = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDuration(400)
      .maxDistance(10)
      .runOnJS(true)
      .onEnd((e, success) => {
        if (success && tool !== "pan")
          latest.current.onPoint(
            screenToWorld({ x: e.x, y: e.y }, latest.current.viewport),
          );
      });
    // Pinch owns two fingers. The pan tool uses one finger, avoiding competing viewport writers.
    const pan = Gesture.Pan()
      .minPointers(tool === "pan" ? 1 : 2)
      .maxPointers(tool === "pan" ? 1 : 2)
      .minDistance(4)
      .runOnJS(true)
      .onStart(() => {
        panOrigin.value = {
          x: latest.current.viewport.x,
          y: latest.current.viewport.y,
        };
      })
      .onUpdate((e) => {
        latest.current.onViewport({
          ...latest.current.viewport,
          x: panOrigin.value.x + e.translationX,
          y: panOrigin.value.y + e.translationY,
        });
      });
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart((e) => {
        pinchOrigin.value = latest.current.viewport;
        pinchFocal.value = { x: e.focalX, y: e.focalY };
      })
      .onUpdate((e) => {
        const next = zoomAt(pinchOrigin.value, pinchFocal.value, e.scale);
        latest.current.onViewport({
          ...next,
          x: next.x + e.focalX - pinchFocal.value.x,
          y: next.y + e.focalY - pinchFocal.value.y,
        });
      });
    return Gesture.Race(pinch, pan, tap);
  }, [tool, panOrigin, pinchOrigin, pinchFocal]);
  const stepMm = Math.pow(10, Math.ceil(Math.log10(35 / viewport.scale)));
  const stepPx = stepMm * viewport.scale;
  const gridLines = [];
  if (grid && size.width && size.height) {
    const x0 = ((viewport.x % stepPx) + stepPx) % stepPx;
    const y0 = ((viewport.y % stepPx) + stepPx) % stepPx;
    for (let x = x0; x < size.width; x += stepPx)
      gridLines.push(
        <Line
          key={`x${x}`}
          p1={{ x, y: 0 }}
          p2={{ x, y: size.height }}
          color={colors.grid}
          strokeWidth={0.6}
        />,
      );
    for (let y = y0; y < size.height; y += stepPx)
      gridLines.push(
        <Line
          key={`y${y}`}
          p1={{ x: 0, y }}
          p2={{ x: size.width, y }}
          color={colors.grid}
          strokeWidth={0.6}
        />,
      );
  }
  return (
    <View
      style={{ flex: 1, backgroundColor: colors.canvas }}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      <GestureDetector gesture={gestures}>
        <View
          collapsable={false}
          style={{ flex: 1 }}
          accessibilityLabel="Milimetre tabanlı teknik çizim yüzeyi"
        >
          <Canvas style={{ flex: 1 }}>
            {gridLines}
            <Line
              p1={{ x: viewport.x, y: 0 }}
              p2={{ x: viewport.x, y: size.height }}
              color={colors.muted}
              opacity={0.3}
              strokeWidth={1}
            />
            <Line
              p1={{ x: 0, y: viewport.y }}
              p2={{ x: size.width, y: viewport.y }}
              color={colors.muted}
              opacity={0.3}
              strokeWidth={1}
            />
            {document.paths.map((p) => {
              const path = Skia.Path.Polygon(
                p.points.map((point) => worldToScreen(point, viewport)),
                false,
              );
              return (
                <Path
                  key={p.id}
                  path={path}
                  style="stroke"
                  strokeWidth={selectedId === p.id ? 4 : 2}
                  strokeCap="round"
                  strokeJoin="round"
                  color={selectedId === p.id ? colors.accent : colors.text}
                />
              );
            })}
            {document.paths.flatMap((p) =>
              p.points.map((point, index) => {
                const s = worldToScreen(point, viewport);
                return (
                  <Circle
                    key={`${p.id}-${index}`}
                    cx={s.x}
                    cy={s.y}
                    r={3.5}
                    color={colors.accent}
                  />
                );
              }),
            )}
            {document.dimensions.map((d) => (
              <Line
                key={d.id}
                p1={worldToScreen(d.from, viewport)}
                p2={worldToScreen(d.to, viewport)}
                color={selectedId === d.id ? colors.text : colors.accent}
                strokeWidth={selectedId === d.id ? 3 : 1.5}
              />
            ))}
            {measureStart && (
              <Circle
                c={worldToScreen(measureStart, viewport)}
                r={6}
                color={colors.accent}
              />
            )}
          </Canvas>
        </View>
      </GestureDetector>
      {document.dimensions.map((d) => {
        const a = worldToScreen(d.from, viewport);
        const b = worldToScreen(d.to, viewport);
        const x = (a.x + b.x) / 2;
        const y = (a.y + b.y) / 2;
        if (x < 0 || y < 0 || x > size.width - 70 || y > size.height - 20)
          return null;
        return (
          <Text
            pointerEvents="none"
            key={d.id}
            style={{
              position: "absolute",
              left: x,
              top: y - 24,
              color: colors.accent,
              backgroundColor: colors.canvas,
              fontSize: 11,
              padding: 3,
            }}
          >
            {Math.round(d.lengthMm).toLocaleString("tr-TR")} mm
          </Text>
        );
      })}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 14,
          bottom: 12,
          padding: 7,
          backgroundColor: colors.surface,
          borderRadius: 7,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 10 }}>
          {grid ? `Izgara ${stepMm.toLocaleString("tr-TR")} mm · ` : ""}
          {Math.round(viewport.scale * 1000)} px / m
        </Text>
      </View>
    </View>
  );
}

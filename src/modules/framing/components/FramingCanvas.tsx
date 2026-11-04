import { useMemo, useRef } from "react";
import { View, Text } from "react-native";
import { Canvas, Path, Line, Circle, Skia } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { useTheme } from "../../../core/theme/theme";
import {
  worldToScreen,
  screenToWorld,
  zoomAt,
} from "../../drawing/coordinates";
import { FRAMING } from "../config";
import type { FramingWorkspace } from "../hooks/useFramingWorkspace";
export function FramingCanvas({
  workspace: w,
}: {
  workspace: FramingWorkspace;
}) {
  const { colors } = useTheme();
  const latest = useRef(w);
  latest.current = w;
  const panOrigin = useSharedValue({ x: 0, y: 0 }),
    pinchOrigin = useSharedValue(w.viewport),
    focal = useSharedValue({ x: 0, y: 0 });
  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDistance(9)
      .maxDuration(400)
      .runOnJS(true)
      .onEnd((e, ok) => {
        if (ok)
          latest.current.pick(
            screenToWorld({ x: e.x, y: e.y }, latest.current.viewport),
          );
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
        focal.value = { x: e.focalX, y: e.focalY };
      })
      .onUpdate((e) => {
        const p = zoomAt(pinchOrigin.value, focal.value, e.scale);
        latest.current.setViewport({
          ...p,
          x: p.x + e.focalX - focal.value.x,
          y: p.y + e.focalY - focal.value.y,
        });
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
      .onEnd((_, ok) => latest.current.dragEnd(!ok))
      .onFinalize((_, ok) => {
        if (!ok) latest.current.dragEnd(true);
      });
    return Gesture.Race(pinch, drag, pan, tap);
  }, [w.tool, panOrigin, pinchOrigin, focal]);
  const v = w.viewport;
  const profiles = (w.plan?.members ?? []).filter((m) => w.visibility[m.layer]);
  const selected = w.selected;
  const middle = selected
    ? worldToScreen(
        {
          x: (selected.start.x + selected.end.x) / 2,
          y: (selected.start.y + selected.end.y) / 2,
        },
        v,
      )
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
      <GestureDetector gesture={gesture}>
        <View
          collapsable={false}
          accessibilityLabel="İki katmanlı karkas çizim yüzeyi"
          style={{ flex: 1 }}
        >
          <Canvas style={{ flex: 1 }}>
            {w.drawing.paths
              .filter((p) => p.role !== "draft")
              .map((p) => (
                <Path
                  key={p.id}
                  path={Skia.Path.Polygon(
                    p.points.map((q) => worldToScreen(q, v)),
                    p.closed,
                  )}
                  style={p.role === "void" ? "fill" : "stroke"}
                  color={
                    p.role === "void" ? FRAMING.colors.void : colors.border
                  }
                  strokeWidth={1}
                  opacity={p.role === "void" ? 0.35 : 1}
                />
              ))}
            {profiles.map((m) => {
              const delta = w.preview?.id === m.id ? w.preview : null,
                a = worldToScreen(
                  {
                    x: m.start.x + (delta?.dx ?? 0),
                    y: m.start.y + (delta?.dy ?? 0),
                  },
                  v,
                ),
                b = worldToScreen(
                  {
                    x: m.end.x + (delta?.dx ?? 0),
                    y: m.end.y + (delta?.dy ?? 0),
                  },
                  v,
                );
              return (
                <Line
                  key={m.id}
                  p1={a}
                  p2={b}
                  color={
                    w.selection === m.id
                      ? colors.text
                      : m.role === "jointSupport"
                        ? FRAMING.colors.joint
                        : FRAMING.colors[m.layer]
                  }
                  strokeWidth={
                    w.selection === m.id ? 5 : m.layer === "lower" ? 3 : 2
                  }
                  strokeCap="round"
                />
              );
            })}
            {(w.plan?.supports ?? [])
              .filter(
                (s) => !s.memberId || profiles.some((m) => m.id === s.memberId),
              )
              .map((s) => (
                <Circle
                  key={s.id}
                  c={worldToScreen(s.at, v)}
                  r={3.5}
                  color={colors.muted}
                />
              ))}
            {w.anchor && (
              <Circle
                c={worldToScreen(w.anchor, v)}
                r={6}
                color={colors.accent}
              />
            )}
          </Canvas>
        </View>
      </GestureDetector>
      {middle &&
        selected &&
        middle.x >= 0 &&
        middle.y >= 0 &&
        middle.x < w.size.width - 100 &&
        middle.y < w.size.height - 30 && (
          <Text
            pointerEvents="none"
            style={{
              position: "absolute",
              left: middle.x,
              top: middle.y - 23,
              padding: 4,
              color: colors.text,
              backgroundColor: colors.surface,
              fontSize: 11,
            }}
          >
            {selected.code} · {(selected.lengthMm / 1000).toFixed(2)} m
          </Text>
        )}
      <View
        pointerEvents="none"
        style={{ position: "absolute", bottom: 9, left: 9, right: 9 }}
      >
        <Text
          style={{
            fontSize: 10,
            color: colors.muted,
            backgroundColor: colors.canvas,
          }}
        >
          Çizgi kalınlığı görseldir · Gerçek kesit profil özelliklerindedir.
        </Text>
      </View>
    </View>
  );
}

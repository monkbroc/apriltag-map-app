import { useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
  useExclusiveGestures,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { hitTest, zoomAbout, type Layout, type MapBounds } from '@/core/mapView';
import { apply3, rotationOf, translationOf, type Mat4 } from '@/core/math';
import type { FieldDimensions } from '@/core/types';

import { useTheme } from './theme';

export interface MapTag {
  id: number;
  transform: Mat4;
}

const MAX_ZOOM = 12;

/**
 * Top-down field map (R-5.7). Field +X points right and +Y up on screen; the axes are drawn at
 * the WPIBlue origin (blue-alliance corner). Pinch to zoom, drag to pan, double-tap to reset.
 * Markers and their tap areas scale with the zoom. In comparison mode, `previous` poses are
 * drawn as hollow grey markers.
 */
export function FieldMap({
  tags,
  previous,
  field,
  onTagPress,
  style,
}: {
  tags: readonly MapTag[];
  previous?: readonly MapTag[];
  field: FieldDimensions;
  onTagPress?: (id: number) => void;
  /** Size of the map; defaults to a 2:1 box. Pass `{ flex: 1 }` to fill the parent. */
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const [layout, setLayout] = useState<Layout>({ width: 1, height: 1 });

  const bounds: MapBounds = useMemo(() => {
    let halfX = field.lengthM / 2 + 0.5;
    let halfY = field.widthM / 2 + 0.5;
    for (const tag of [...tags, ...(previous ?? [])]) {
      const [x, y] = translationOf(tag.transform);
      halfX = Math.max(halfX, Math.abs(x) + 0.5);
      halfY = Math.max(halfY, Math.abs(y) + 0.5);
    }
    return { halfX, halfY };
  }, [field, tags, previous]);

  const width = bounds.halfX * 2;
  const height = bounds.halfY * 2;
  // Screen y grows downward, so flip field Y.
  const sx = (x: number) => x + bounds.halfX;
  const sy = (y: number) => bounds.halfY - y;
  const markerR = Math.max(width, height) / 90;
  const arrowLen = markerR * 3.2;
  // Sized so two-digit IDs fit inside the dot.
  const fontSize = markerR * 1.15;
  const prevIds = new Set((previous ?? []).map((p) => p.id));
  const blueX = -field.lengthM / 2;
  const blueY = -field.widthM / 2;

  // ---- zoom and pan (UI thread)
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      const next = Math.min(MAX_ZOOM, Math.max(1, scale.value * e.scaleChange));
      const z = zoomAbout(
        { tx: tx.value, ty: ty.value, scale: scale.value },
        next,
        e.focalX,
        e.focalY,
      );
      scale.value = z.scale;
      tx.value = z.tx;
      ty.value = z.ty;
    },
  });
  const pan = usePanGesture({
    minDistance: 8,
    onUpdate: (e) => {
      'worklet';
      tx.value += e.changeX;
      ty.value += e.changeY;
    },
  });
  const reset = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      'worklet';
      scale.value = withTiming(1);
      tx.value = withTiming(0);
      ty.value = withTiming(0);
    },
  });
  const tap = useTapGesture({
    runOnJS: true,
    onActivate: (e) => {
      if (!onTagPress) return;
      const id = hitTest(
        e.x,
        e.y,
        tags.map((tag) => {
          const [x, y] = translationOf(tag.transform);
          return { id: tag.id, x, y };
        }),
        bounds,
        layout,
        { tx: tx.value, ty: ty.value, scale: scale.value },
        markerR * 2,
      );
      if (id !== null) onTagPress(id);
    },
  });
  const gesture = useSimultaneousGestures(pinch, pan, useExclusiveGestures(reset, tap));

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const marker = (tag: MapTag, ghost: boolean) => {
    const [x, y] = translationOf(tag.transform);
    const n = apply3(rotationOf(tag.transform), [1, 0, 0]);
    const len = Math.hypot(n[0], n[1]) || 1;
    const [dx, dy] = [n[0] / len, n[1] / len];
    const tip: [number, number] = [sx(x + dx * arrowLen), sy(y + dy * arrowLen)];
    const color = ghost ? t.ghost : t.primary;
    return (
      <G key={`${ghost ? 'old' : 'new'}-${tag.id}`}>
        <Line
          x1={sx(x)}
          y1={sy(y)}
          x2={tip[0]}
          y2={tip[1]}
          stroke={color}
          strokeWidth={markerR / 2.5}
        />
        <Polygon
          points={[
            tip,
            [tip[0] - (dx * 1.2 - dy * 0.7) * markerR, tip[1] + (dy * 1.2 + dx * 0.7) * markerR],
            [tip[0] - (dx * 1.2 + dy * 0.7) * markerR, tip[1] + (dy * 1.2 - dx * 0.7) * markerR],
          ]
            .map((p) => p.join(','))
            .join(' ')}
          fill={color}
        />
        <Circle
          cx={sx(x)}
          cy={sy(y)}
          r={markerR}
          fill={ghost ? 'none' : t.tagFill}
          stroke={color}
          strokeWidth={markerR / 6}
        />
        {!ghost ? (
          // The ID sits inside its own dot so it can't be mistaken for a neighbor's label.
          <SvgText
            x={sx(x)}
            y={sy(y) + fontSize * 0.36}
            fontSize={fontSize}
            fontWeight="bold"
            fill={t.tagText}
            textAnchor="middle"
          >
            {tag.id}
          </SvgText>
        ) : null}
      </G>
    );
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.box, style]}
        onLayout={(e) => setLayout(e.nativeEvent.layout)}
        accessibilityLabel={`Field map with ${tags.length} tags. Pinch to zoom, double-tap to reset.`}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.origin, animated]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
            <Rect
              x={sx(-field.lengthM / 2)}
              y={sy(field.widthM / 2)}
              width={field.lengthM}
              height={field.widthM}
              fill="none"
              stroke={t.fieldLine}
              strokeWidth={markerR / 3}
            />
            {/* WPIBlue origin (blue-alliance corner) and axes: +X red, +Y green */}
            <Line
              x1={sx(blueX)}
              y1={sy(blueY)}
              x2={sx(blueX + 1)}
              y2={sy(blueY)}
              stroke={t.red}
              strokeWidth={markerR / 2}
            />
            <Line
              x1={sx(blueX)}
              y1={sy(blueY)}
              x2={sx(blueX)}
              y2={sy(blueY + 1)}
              stroke={t.green}
              strokeWidth={markerR / 2}
            />
            {previous?.map((p) => {
              const now = tags.find((tag) => tag.id === p.id);
              if (!now) return null;
              const [x0, y0] = translationOf(p.transform);
              const [x1, y1] = translationOf(now.transform);
              return (
                <Line
                  key={`move-${p.id}`}
                  x1={sx(x0)}
                  y1={sy(y0)}
                  x2={sx(x1)}
                  y2={sy(y1)}
                  stroke={t.yellow}
                  strokeWidth={markerR / 3}
                />
              );
            })}
            {previous?.filter((p) => prevIds.has(p.id)).map((p) => marker(p, true))}
            {tags.map((tag) => marker(tag, false))}
          </Svg>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', aspectRatio: 2, overflow: 'hidden' },
  origin: { transformOrigin: 'left top' },
});

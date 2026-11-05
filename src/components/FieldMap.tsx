import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { apply3, rotationOf, translationOf, type Mat4 } from '@/core/math';
import type { FieldDimensions } from '@/core/types';

import { useTheme } from './theme';

export interface MapTag {
  id: number;
  transform: Mat4;
}

/**
 * Static top-down field map (R-5.7). Field +X points right, +Y points up on screen.
 * In comparison mode, `previous` poses are drawn as hollow grey markers.
 */
export function FieldMap({
  tags,
  previous,
  field,
  onTagPress,
  aspectRatio = 2,
}: {
  tags: readonly MapTag[];
  previous?: readonly MapTag[];
  field?: FieldDimensions;
  onTagPress?: (id: number) => void;
  aspectRatio?: number;
}) {
  const t = useTheme();

  const bounds = useMemo(() => {
    if (field) return { halfX: field.lengthM / 2 + 0.5, halfY: field.widthM / 2 + 0.5 };
    let halfX = 1;
    let halfY = 1;
    for (const tag of [...tags, ...(previous ?? [])]) {
      const [x, y] = translationOf(tag.transform);
      halfX = Math.max(halfX, Math.abs(x) + 1);
      halfY = Math.max(halfY, Math.abs(y) + 1);
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
  const fontSize = markerR * 2.2;
  const prevById = new Map((previous ?? []).map((p) => [p.id, p]));

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
          fill={ghost ? 'none' : color}
          stroke={color}
          strokeWidth={markerR / 3}
          onPress={onTagPress && !ghost ? () => onTagPress(tag.id) : undefined}
        />
        {!ghost ? (
          <SvgText
            x={sx(x)}
            y={sy(y) - markerR * 1.6}
            fontSize={fontSize}
            fill={t.text}
            textAnchor="middle"
            onPress={onTagPress ? () => onTagPress(tag.id) : undefined}
          >
            {tag.id}
          </SvgText>
        ) : null}
      </G>
    );
  };

  return (
    <View
      style={{ width: '100%', aspectRatio: Math.max(aspectRatio, width / height) }}
      accessibilityLabel={`Field map with ${tags.length} tags`}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {field ? (
          <Rect
            x={sx(-field.lengthM / 2)}
            y={sy(field.widthM / 2)}
            width={field.lengthM}
            height={field.widthM}
            fill="none"
            stroke={t.fieldLine}
            strokeWidth={markerR / 3}
          />
        ) : null}
        {/* Origin and axes */}
        <Line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(1)}
          y2={sy(0)}
          stroke={t.red}
          strokeWidth={markerR / 3}
        />
        <Line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(0)}
          y2={sy(1)}
          stroke={t.green}
          strokeWidth={markerR / 3}
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
        {previous?.filter((p) => prevById.has(p.id)).map((p) => marker(p, true))}
        {tags.map((tag) => marker(tag, false))}
      </Svg>
    </View>
  );
}

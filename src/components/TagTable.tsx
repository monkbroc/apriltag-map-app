import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatNumber, poseFromTransform } from '@/core/pose';
import type { Fiducial } from '@/core/types';

import { spacing, useTheme } from './theme';

const columns = ['ID', 'x', 'y', 'z', 'yaw', 'pitch', 'roll', 'size', 'obs'] as const;
const widths = [40, 64, 64, 56, 56, 56, 56, 60, 44];

/** Tag table (R-5.6.2): positions in m, angles in degrees, size in mm. */
export function TagTable({
  fiducials,
  onTagPress,
}: {
  fiducials: readonly Fiducial[];
  onTagPress?: (id: number) => void;
}) {
  const t = useTheme();
  const cell = (text: string, i: number, header = false) => (
    <Text
      key={i}
      style={[
        styles.cell,
        { width: widths[i], color: header ? t.muted : t.text, fontWeight: header ? '600' : '400' },
      ]}
    >
      {text}
    </Text>
  );

  return (
    <ScrollView horizontal>
      <View>
        <View style={[styles.row, { borderColor: t.border }]}>
          {columns.map((c, i) => cell(c, i, true))}
        </View>
        {fiducials.map((f) => {
          const p = poseFromTransform(f.transform);
          const values = [
            String(f.id),
            formatNumber(p.x),
            formatNumber(p.y),
            formatNumber(p.z),
            formatNumber(p.yawDeg, 1),
            formatNumber(p.pitchDeg, 1),
            formatNumber(p.rollDeg, 1),
            formatNumber(f.size, 1),
            f.observationCount != null ? String(f.observationCount) : '—',
          ];
          return (
            <Pressable
              key={f.id}
              accessibilityRole={onTagPress ? 'button' : undefined}
              accessibilityLabel={`Tag ${f.id}`}
              onPress={onTagPress ? () => onTagPress(f.id) : undefined}
              style={[styles.row, { borderColor: t.border }]}
            >
              {values.map((v, i) => cell(v, i))}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  cell: { paddingHorizontal: spacing.xs, fontVariant: ['tabular-nums'], textAlign: 'right' },
});

import { StyleSheet, Text, View } from 'react-native';

import type { DiffRow } from '@/core/diff';
import { formatNumber } from '@/core/pose';

import { spacing, useTheme } from './theme';

const ICON = { green: '✓', yellow: '!', red: '✕' } as const;
const LEVEL_TEXT = { green: 'small change', yellow: 'moderate change', red: 'large change' };

/** One row of the refine comparison (R-5.5.1, R-5.5.2). Color is always paired with an icon. */
export function DeltaRow({ row }: { row: DiffRow }) {
  const t = useTheme();
  const color = row.level ? t[row.level] : t.muted;
  const statusText =
    row.status === 'updated' ? 'Updated' : row.status === 'new' ? 'New' : 'Not scanned';

  let detail = '';
  let label = `Tag ${row.tagId}, ${statusText}`;
  if (row.status === 'updated') {
    const cm = formatNumber(row.positionDeltaM! * 100, 1);
    const deg = formatNumber(row.rotationDeltaDeg!, 1);
    const pct = row.percentChange == null ? '—' : `${formatNumber(row.percentChange, 1)}%`;
    detail = `${cm} cm · ${deg}° · ${pct} · ${row.count} obs`;
    label += `, moved ${cm} centimeters, rotated ${deg} degrees, ${pct} change, ${LEVEL_TEXT[row.level!]}`;
  } else if (row.status === 'new') {
    detail = `${row.count} obs`;
  } else {
    detail = 'kept from the reference';
  }

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.row, { borderColor: t.border, backgroundColor: t.surface }]}
    >
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>
          {row.level ? ICON[row.level] : row.status === 'new' ? '+' : '–'}
        </Text>
      </View>
      <Text style={[styles.id, { color: t.text }]}>{row.tagId}</Text>
      <View style={styles.flex}>
        <Text style={{ color: t.text, fontWeight: '600' }}>{statusText}</Text>
        <Text style={{ color: t.muted, fontVariant: ['tabular-nums'] }}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontWeight: '700' },
  id: { fontSize: 18, fontWeight: '700', width: 36, textAlign: 'right' },
});

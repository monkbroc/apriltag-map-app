import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { serializeFmap } from '@/core/fmap';
import type { Fiducial } from '@/core/types';

import { spacing, useTheme } from './theme';
import { Button } from './ui';

/** Read-only view of the exact .fmap that would be exported (R-5.8). */
export function JsonView({ fiducials }: { fiducials: readonly Fiducial[] }) {
  const t = useTheme();
  const text = useMemo(() => serializeFmap(fiducials), [fiducials]);
  const [copied, setCopied] = useState(false);

  return (
    <View style={styles.container}>
      <Button
        title={copied ? 'Copied' : 'Copy to clipboard'}
        variant="secondary"
        onPress={async () => {
          await Clipboard.setStringAsync(text);
          setCopied(true);
        }}
      />
      <ScrollView style={[styles.box, { borderColor: t.border, backgroundColor: t.surface }]}>
        <Text selectable testID="fmap-json" style={[styles.code, { color: t.text }]}>
          {text}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.sm, padding: spacing.md },
  box: { flex: 1, borderWidth: 1, borderRadius: 8, padding: spacing.sm },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 12,
  },
});

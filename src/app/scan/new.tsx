import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { spacing, useTheme } from '@/components/theme';
import { Button, Screen } from '@/components/ui';
import { MIN_OBSERVATIONS } from '@/core/config';

/** Fresh scan setup (R-5.2.1). Refine scans start from a set's Refine action instead. */
export default function NewScanScreen() {
  const t = useTheme();
  const router = useRouter();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={[styles.title, { color: t.text }]}>Fresh scan</Text>
        <Text style={{ color: t.text }}>
          A fresh scan starts with no tags. Walk around the field and point the camera at each tag
          from a few different angles until its chip turns green ({MIN_OBSERVATIONS} good
          sightings).
        </Text>
        <Text style={{ color: t.text }}>
          When you finish, pick one or more reference tags and type in their field poses. Every
          other tag is placed relative to them.
        </Text>
        <Text style={{ color: t.muted }}>
          To improve an existing map instead, open it and choose Refine.
        </Text>
        <Button
          title="Start scanning"
          onPress={() => router.replace('/scan/session')}
          accessibilityHint="Opens the camera"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.lg },
  title: { fontSize: 22, fontWeight: '700' },
});

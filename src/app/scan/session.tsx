import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { G, Polygon, Text as SvgText } from 'react-native-svg';

import { useTheme, spacing } from '@/components/theme';
import { Button } from '@/components/ui';
import { DEFAULT_TAG_SIZE_MM, MIN_OBSERVATIONS } from '@/core/config';
import { ApriltagArView, isArSupported, requestCameraPermission } from '@/native';
import { findSet, useLibrary } from '@/state/library';
import { useScanSession } from '@/state/scanSession';

type Readiness = 'checking' | 'ready' | 'unsupported' | 'denied';

/** AR scanning screen (R-5.3). `?refine=<setId>` starts a refine scan (R-5.2.2). */
export default function ScanSessionScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refine } = useLocalSearchParams<{ refine?: string }>();
  const userSets = useLibrary((s) => s.userSets);
  const reference = refine ? findSet(userSets, refine) : undefined;
  const session = useScanSession();
  const [readiness, setReadiness] = useState<Readiness>('checking');
  const [size, setSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    useScanSession.getState().start(refine ? 'refine' : 'fresh', refine);
    let cancelled = false;
    (async () => {
      const supported = await isArSupported();
      const granted = supported && (await requestCameraPermission());
      if (!cancelled) setReadiness(!supported ? 'unsupported' : granted ? 'ready' : 'denied');
    })();
    return () => {
      cancelled = true;
    };
  }, [refine]);

  const counts = Object.entries(session.counts)
    .map(([id, n]) => ({ id: Number(id), n }))
    .sort((a, b) => a.id - b.id);
  const ready = counts.filter((c) => c.n >= MIN_OBSERVATIONS).length;

  const cancel = () =>
    Alert.alert('Discard scan?', 'All observations from this scan will be lost.', [
      { text: 'Keep scanning', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);

  if (readiness !== 'ready') {
    const message =
      readiness === 'checking'
        ? 'Starting the camera…'
        : readiness === 'unsupported'
          ? 'This device does not support ARKit / ARCore, so it cannot scan. You can still view, edit, import and export tag sets.'
          : 'Camera access is needed to scan tags. Enable it in the phone settings for this app.';
    return (
      <View style={[styles.center, { backgroundColor: t.background, paddingTop: insets.top }]}>
        <Text style={[styles.message, { color: t.text }]}>{message}</Text>
        {readiness === 'denied' ? (
          <Button title="Open settings" onPress={() => Linking.openSettings()} />
        ) : null}
        {readiness !== 'checking' ? (
          <Button title="Back" variant="secondary" onPress={() => router.back()} />
        ) : null}
      </View>
    );
  }

  const trackingText =
    session.tracking === 'normal'
      ? 'Tracking: normal'
      : session.tracking === 'limited'
        ? `Tracking: limited${session.trackingReason ? ` (${session.trackingReason})` : ''}`
        : 'Tracking: not available';

  return (
    <View
      style={styles.flex}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
      accessibilityLabel="Camera view"
    >
      <ApriltagArView
        style={StyleSheet.absoluteFill}
        paused={session.paused}
        tagSizeM={(reference?.fiducials[0]?.size ?? DEFAULT_TAG_SIZE_MM) / 1000}
        maxRateHz={10}
        onFrame={(e) => session.ingestFrame(e.nativeEvent)}
        onError={(e) => Alert.alert('AR error', e.nativeEvent.message)}
      />
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {session.overlay.map((tag) => {
          const pts = [0, 1, 2, 3].map(
            (i) =>
              [tag.corners[2 * i]! * size.width, tag.corners[2 * i + 1]! * size.height] as const,
          );
          const cx = pts.reduce((s, p) => s + p[0], 0) / 4;
          const cy = pts.reduce((s, p) => s + p[1], 0) / 4;
          const seen = (session.counts[tag.id] ?? 0) >= MIN_OBSERVATIONS;
          return (
            <G key={tag.id}>
              <Polygon
                points={pts.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke={seen ? t.green : t.yellow}
                strokeWidth={3}
              />
              <SvgText
                x={cx}
                y={cy}
                fill="#fff"
                stroke="#000"
                strokeWidth={0.6}
                fontSize={22}
                fontWeight="bold"
                textAnchor="middle"
              >
                {tag.id}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      <View style={[styles.hud, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.hudText} accessibilityLiveRegion="polite">
          {trackingText}
          {session.paused ? ' · paused' : ''}
        </Text>
        <Text style={styles.hudText}>
          {reference ? `Refining ${reference.name} · ` : 'Fresh scan · '}
          {ready} of {counts.length} tags seen {MIN_OBSERVATIONS}+ times
        </Text>
        <ScrollView horizontal contentContainerStyle={styles.chips}>
          {counts.map((c) => {
            const done = c.n >= MIN_OBSERVATIONS;
            return (
              <View
                key={c.id}
                accessibilityLabel={`Tag ${c.id}, ${c.n} sightings${done ? ', done' : ''}`}
                style={[styles.chip, { backgroundColor: done ? t.green : 'rgba(0,0,0,0.6)' }]}
              >
                <Text style={styles.chipText}>
                  {done ? '✓ ' : ''}
                  {c.id} · {c.n}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button title="Cancel" variant="secondary" onPress={cancel} style={styles.flex} />
        <Button
          title={session.paused ? 'Resume' : 'Pause'}
          variant="secondary"
          onPress={() => session.setPaused(!session.paused)}
          style={styles.flex}
        />
        <Button
          title="Finish"
          disabled={ready === 0}
          onPress={() => {
            session.setPaused(true);
            router.push('/scan/align');
          }}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  message: { fontSize: 17, textAlign: 'center' },
  hud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingBottom: spacing.sm,
  },
  hudText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  chips: { gap: spacing.xs, paddingVertical: spacing.xs },
  chip: { borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  chipText: { color: '#fff', fontVariant: ['tabular-nums'] },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { NumberField, numberError } from '@/components/NumberField';
import { spacing, useTheme } from '@/components/theme';
import { Button, Screen } from '@/components/ui';
import { DEFAULT_FIELD, MIN_OBSERVATIONS, RMS_WARN_M } from '@/core/config';
import { fromWpiBlue } from '@/core/fieldFrame';
import { formatNumber, parseNumber, transformFromPose, type PoseFields } from '@/core/pose';
import { computeScanOutcome, OUTCOME_MESSAGES } from '@/core/session';
import { findSet, useLibrary } from '@/state/library';
import { useScanSession } from '@/state/scanSession';

const POSE_KEYS = [
  ['x', 'x', 'm'],
  ['y', 'y', 'm'],
  ['z', 'z', 'm'],
  ['yawDeg', 'Yaw', '°'],
  ['pitchDeg', 'Pitch', '°'],
  ['rollDeg', 'Roll', '°'],
] as const;

/** Default reference pose: the WPIBlue origin (blue-alliance corner), identity rotation. */
const ORIGIN: PoseFields = { x: 0, y: 0, z: 0, yawDeg: 0, pitchDeg: 0, rollDeg: 0 };

/** Inline editor for a fresh-mode reference tag's field pose (R-5.4.2). */
function PoseEditor({ pose, onChange }: { pose: PoseFields; onChange: (p: PoseFields) => void }) {
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(POSE_KEYS.map(([k]) => [k, formatNumber(pose[k], 6)])),
  );
  const update = (k: keyof PoseFields, text: string) => {
    const next = { ...draft, [k]: text };
    setDraft(next);
    const values = POSE_KEYS.map(([key]) => parseNumber(next[key] ?? ''));
    if (values.every((v) => v !== null)) {
      onChange(
        Object.fromEntries(POSE_KEYS.map(([key], i) => [key, values[i]])) as unknown as PoseFields,
      );
    }
  };
  return (
    <View style={styles.poseGrid}>
      {[POSE_KEYS.slice(0, 3), POSE_KEYS.slice(3)].map((group, i) => (
        <View key={i} style={styles.row}>
          {group.map(([k, label, unit]) => (
            <NumberField
              key={k}
              label={label}
              unit={unit}
              value={draft[k] ?? ''}
              onChange={(text) => update(k, text)}
              error={numberError(draft[k] ?? '')}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Align the scan to the field frame and review residuals (R-5.4). */
export default function AlignScreen() {
  const t = useTheme();
  const router = useRouter();
  const userSets = useLibrary((s) => s.userSets);
  const session = useScanSession();
  const { mode, referenceSetId, freshReferences, excludedIds, setFreshReference, toggleExcluded } =
    session;
  const aggregated = useMemo(() => session.aggregated(), [session]);
  const eligible = aggregated.filter((a) => a.count >= MIN_OBSERVATIONS);
  const referenceSet = referenceSetId ? findSet(userSets, referenceSetId) : undefined;

  // Fresh mode default: the lowest-numbered well-seen tag at the origin.
  const firstEligible = eligible[0]?.tagId;
  useEffect(() => {
    if (mode === 'fresh' && firstEligible !== undefined && !Object.keys(freshReferences).length) {
      setFreshReference(firstEligible, ORIGIN);
    }
  }, [mode, firstEligible, freshReferences, setFreshReference]);

  const reference = useMemo(
    () =>
      mode === 'refine'
        ? (referenceSet?.fiducials ?? [])
        : Object.entries(freshReferences).map(([id, pose]) => ({
            id: Number(id),
            transform: fromWpiBlue(transformFromPose(pose), DEFAULT_FIELD),
          })),
    [mode, referenceSet, freshReferences],
  );
  const outcome = computeScanOutcome(aggregated, reference, new Set(excludedIds));
  const residualById = new Map(
    outcome.ok ? outcome.alignment.residuals.map((r) => [r.tagId, r.residualM]) : [],
  );
  const refIds = new Set(reference.map((r) => r.id));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text style={{ color: t.text }}>
          {mode === 'refine'
            ? `Scanned tags are fitted onto "${referenceSet?.name ?? 'the reference set'}". Untick a tag that was physically moved so it does not skew the fit; it is still updated from the scan.`
            : 'Turn on one or more reference tags and type in their field poses (WPIBlue: origin at the blue-alliance corner). Every other tag is placed relative to them.'}
        </Text>

        {outcome.ok ? (
          <View
            style={[
              styles.box,
              {
                borderColor: outcome.alignment.rmsM > RMS_WARN_M ? t.yellow : t.green,
                backgroundColor: t.surface,
              },
            ]}
          >
            <Text style={[styles.bold, { color: t.text }]}>
              {outcome.alignment.method === 'single-tag'
                ? 'Aligned on a single tag'
                : `Fit RMS: ${formatNumber(outcome.alignment.rmsM * 100, 1)} cm`}
            </Text>
            {outcome.alignment.rmsM > RMS_WARN_M ? (
              <Text style={{ color: t.yellow }} accessibilityRole="alert">
                ⚠ The RMS is above {RMS_WARN_M * 100} cm. Some tags may have moved, or the scan
                drifted. Exclude outliers or rescan.
              </Text>
            ) : null}
          </View>
        ) : (
          <View
            accessibilityRole="alert"
            style={[styles.box, { borderColor: t.danger, backgroundColor: t.surface }]}
          >
            <Text style={{ color: t.danger }}>✕ {OUTCOME_MESSAGES[outcome.error]}</Text>
          </View>
        )}

        {eligible.map((a) => {
          const inRef = refIds.has(a.tagId);
          const excluded = excludedIds.includes(a.tagId);
          const residual = residualById.get(a.tagId);
          const freshPose = freshReferences[a.tagId];
          return (
            <View
              key={a.tagId}
              style={[styles.box, { borderColor: t.border, backgroundColor: t.surface }]}
            >
              <View style={styles.rowCenter}>
                <View style={styles.flex}>
                  <Text style={[styles.bold, { color: t.text }]}>Tag {a.tagId}</Text>
                  <Text style={{ color: t.muted }}>
                    {a.count} sightings
                    {residual !== undefined
                      ? ` · residual ${formatNumber(residual * 100, 1)} cm${excluded ? ' (excluded)' : ''}`
                      : mode === 'refine'
                        ? ' · not in reference (new)'
                        : ''}
                  </Text>
                </View>
                {mode === 'refine' && inRef ? (
                  <Pressable accessibilityLabel={`Use tag ${a.tagId} in fit`} style={styles.toggle}>
                    <Text style={{ color: t.muted }}>Use in fit</Text>
                    <Switch value={!excluded} onValueChange={() => toggleExcluded(a.tagId)} />
                  </Pressable>
                ) : null}
                {mode === 'fresh' ? (
                  <View style={styles.toggle}>
                    <Text style={{ color: t.muted }}>Reference</Text>
                    <Switch
                      accessibilityLabel={`Use tag ${a.tagId} as a reference`}
                      value={!!freshPose}
                      onValueChange={(on) => setFreshReference(a.tagId, on ? ORIGIN : null)}
                    />
                  </View>
                ) : null}
              </View>
              {mode === 'fresh' && freshPose ? (
                <PoseEditor pose={freshPose} onChange={(p) => setFreshReference(a.tagId, p)} />
              ) : null}
            </View>
          );
        })}

        <Button
          title="Continue"
          disabled={!outcome.ok}
          onPress={() => router.push(mode === 'refine' ? '/scan/compare' : '/scan/review')}
        />
        <Button title="Back to scanning" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: spacing.lg, gap: spacing.md },
  box: { borderWidth: 1, borderRadius: 10, padding: spacing.md, gap: spacing.sm },
  bold: { fontWeight: '600', fontSize: 16 },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggle: { alignItems: 'center' },
  poseGrid: { gap: spacing.sm },
});

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeltaRow } from '@/components/DeltaRow';
import { FieldMap } from '@/components/FieldMap';
import { Placeholder } from '@/components/Placeholder';
import { spacing, useTheme } from '@/components/theme';
import { Button, PromptDialog, Screen } from '@/components/ui';
import { formatNumber } from '@/core/pose';
import { computeScanOutcome, isoDate, refineResult } from '@/core/session';
import { findSet, nameError, uniqueName, useLibrary } from '@/state/library';
import { useScanSession } from '@/state/scanSession';

const cm = (m: number | null) => (m == null ? '—' : `${formatNumber(m * 100, 1)} cm`);

/** Refine comparison: per-tag deltas, map overlay, save as new / overwrite (R-5.5). */
export default function CompareScreen() {
  const t = useTheme();
  const router = useRouter();
  const { userSets, create, update } = useLibrary();
  const session = useScanSession();
  const reference = session.referenceSetId ? findSet(userSets, session.referenceSetId) : undefined;
  const [naming, setNaming] = useState(false);

  const result = useMemo(() => {
    if (!reference) return null;
    const outcome = computeScanOutcome(
      session.aggregated(),
      reference.fiducials,
      new Set(session.excludedIds),
    );
    if (!outcome.ok) return null;
    return { outcome, ...refineResult(reference.fiducials, outcome.placed) };
  }, [reference, session]);

  if (!reference || !result) return <Placeholder label="Nothing to compare." />;
  const { summary, rows, merged, outcome } = result;

  const finish = (id: string) => {
    router.dismissAll();
    router.push(`/sets/${id}`);
  };

  const overwrite = () =>
    Alert.alert(
      'Overwrite tag set?',
      `"${reference.name}" will be replaced with the refined poses. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Overwrite',
          style: 'destructive',
          onPress: async () => {
            await update({ ...reference, fiducials: merged });
            finish(reference.id);
          },
        },
      ],
    );

  const discard = () =>
    Alert.alert('Discard scan?', 'The refined poses will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.dismissAll() },
    ]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <View
          style={[styles.summary, { borderColor: t.border, backgroundColor: t.surface }]}
          accessible
          accessibilityLabel={`${summary.updated} updated, ${summary.added} new, ${summary.notScanned} not scanned`}
        >
          <Text style={[styles.summaryTitle, { color: t.text }]}>
            {summary.updated} updated · {summary.added} new · {summary.notScanned} not scanned
          </Text>
          <Text style={{ color: t.muted }}>
            Median change {cm(summary.medianPositionDeltaM)} · max {cm(summary.maxPositionDeltaM)} ·
            fit RMS {cm(outcome.alignment.rmsM)}
          </Text>
        </View>

        <FieldMap tags={merged} previous={reference.fiducials} field={reference.field} />
        <Text style={{ color: t.muted }}>
          Grey: before. Blue: after. Yellow lines connect moved tags.
        </Text>

        {rows.map((row) => (
          <DeltaRow key={row.tagId} row={row} />
        ))}

        <Button title="Save as new" onPress={() => setNaming(true)} />
        <Button
          title="Overwrite"
          variant="secondary"
          disabled={reference.builtin}
          accessibilityHint={reference.builtin ? 'Built-in sets cannot be overwritten' : undefined}
          onPress={overwrite}
        />
        {reference.builtin ? (
          <Text style={{ color: t.muted }}>Built-in sets cannot be overwritten.</Text>
        ) : null}
        <Button title="Discard" variant="danger" onPress={discard} />
      </ScrollView>
      <PromptDialog
        visible={naming}
        title="Name the refined tag set"
        initialValue={uniqueName(`${reference.name} (refined ${isoDate()})`, userSets)}
        validate={(v) => nameError(v, userSets)}
        onCancel={() => setNaming(false)}
        onSubmit={async (name) => {
          const set = await create(name, merged, reference.field);
          setNaming(false);
          finish(set.id);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md },
  summary: { borderWidth: 1, borderRadius: 10, padding: spacing.md, gap: spacing.xs },
  summaryTitle: { fontSize: 17, fontWeight: '600' },
});

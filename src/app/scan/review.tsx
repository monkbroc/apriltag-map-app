import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';

import { FieldMap } from '@/components/FieldMap';
import { Placeholder } from '@/components/Placeholder';
import { TagTable } from '@/components/TagTable';
import { spacing, useTheme } from '@/components/theme';
import { Button, PromptDialog, Screen } from '@/components/ui';
import { DEFAULT_FIELD } from '@/core/config';
import { fromWpiBlue } from '@/core/fieldFrame';
import { transformFromPose } from '@/core/pose';
import { computeScanOutcome, freshResult, isoDate } from '@/core/session';
import { nameError, uniqueName, useLibrary } from '@/state/library';
import { useScanSession } from '@/state/scanSession';

/** Fresh-scan review: map, table, save as new (R-5.5.7). */
export default function ReviewScreen() {
  const t = useTheme();
  const router = useRouter();
  const { userSets, create } = useLibrary();
  const session = useScanSession();
  const [naming, setNaming] = useState(false);

  const fiducials = useMemo(() => {
    const reference = Object.entries(session.freshReferences).map(([id, pose]) => ({
      id: Number(id),
      transform: fromWpiBlue(transformFromPose(pose), DEFAULT_FIELD),
    }));
    const outcome = computeScanOutcome(
      session.aggregated(),
      reference,
      new Set(session.excludedIds),
    );
    return outcome.ok ? freshResult(outcome.placed) : null;
  }, [session]);

  if (!fiducials) return <Placeholder label="Nothing to review." />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={{ color: t.text }}>{fiducials.length} tags placed in the field frame.</Text>
        <FieldMap tags={fiducials} field={DEFAULT_FIELD} style={{ aspectRatio: 1.3 }} />
        <TagTable fiducials={fiducials} field={DEFAULT_FIELD} />
        <Button title="Save as new" onPress={() => setNaming(true)} />
        <Button
          title="Discard"
          variant="danger"
          onPress={() =>
            Alert.alert('Discard scan?', 'The scanned tags will be lost.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Discard', style: 'destructive', onPress: () => router.dismissAll() },
            ])
          }
        />
      </ScrollView>
      <PromptDialog
        visible={naming}
        title="Name the new tag set"
        initialValue={uniqueName(`Scan ${isoDate()}`, userSets)}
        validate={(v) => nameError(v, userSets)}
        onCancel={() => setNaming(false)}
        onSubmit={async (name) => {
          const set = await create(name, fiducials, DEFAULT_FIELD);
          setNaming(false);
          router.dismissAll();
          router.push(`/sets/${set.id}`);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md },
});

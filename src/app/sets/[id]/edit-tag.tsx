import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { NumberField, numberError } from '@/components/NumberField';
import { Placeholder } from '@/components/Placeholder';
import { spacing } from '@/components/theme';
import { Button, Screen } from '@/components/ui';
import { DEFAULT_TAG_SIZE_MM, TAG_FAMILY } from '@/core/config';
import { fieldOf, fromWpiBlue, toWpiBlue } from '@/core/fieldFrame';
import { IDENTITY4 } from '@/core/math';
import { formatNumber, parseNumber, poseFromTransform, transformFromPose } from '@/core/pose';
import type { Fiducial, FieldDimensions } from '@/core/types';
import { findSet, useLibrary } from '@/state/library';

const FIELDS = [
  ['x', 'x', 'm'],
  ['y', 'y', 'm'],
  ['z', 'z', 'm'],
  ['yawDeg', 'Yaw', '°'],
  ['pitchDeg', 'Pitch', '°'],
  ['rollDeg', 'Roll', '°'],
] as const;

type Draft = Record<'id' | 'size' | (typeof FIELDS)[number][0], string>;

/** Draft values are shown in WPIBlue; a new tag starts at the WPIBlue origin. */
function draftFrom(f: Fiducial | undefined, field: FieldDimensions): Draft {
  const p = poseFromTransform(f ? toWpiBlue(f.transform, field) : IDENTITY4);
  const fmt = (v: number) => formatNumber(v, 6);
  return {
    id: f ? String(f.id) : '',
    size: fmt(f?.size ?? DEFAULT_TAG_SIZE_MM),
    x: fmt(p.x),
    y: fmt(p.y),
    z: fmt(p.z),
    yawDeg: fmt(p.yawDeg),
    pitchDeg: fmt(p.pitchDeg),
    rollDeg: fmt(p.rollDeg),
  };
}

/** Edit one tag on a draft with explicit Save / Cancel (R-5.6.3, R-5.6.4). */
export default function EditTagScreen() {
  const router = useRouter();
  const { id, tag } = useLocalSearchParams<{ id: string; tag: string }>();
  const { userSets, update } = useLibrary();
  const set = findSet(userSets, id);
  const isNew = tag === 'new';
  const existing = set?.fiducials.find((f) => String(f.id) === tag);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(existing, fieldOf(set ?? {})));

  if (!set || set.builtin || (!isNew && !existing)) {
    return <Placeholder label="This tag cannot be edited." />;
  }

  const idValue = parseNumber(draft.id);
  const idError = !isNew
    ? null
    : idValue === null || !Number.isInteger(idValue) || idValue < 0
      ? 'Enter a whole number ≥ 0.'
      : set.fiducials.some((f) => f.id === idValue)
        ? 'This set already has a tag with this ID.'
        : null;
  const errors: Partial<Record<keyof Draft, string | null>> = {
    id: idError,
    size: numberError(draft.size, { positive: true }),
    ...Object.fromEntries(FIELDS.map(([k]) => [k, numberError(draft[k])])),
  };
  const valid = Object.values(errors).every((e) => !e);
  const set$ = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    const num = (k: keyof Draft) => parseNumber(draft[k])!;
    const fiducial: Fiducial = {
      id: isNew ? num('id') : existing!.id,
      size: num('size'),
      family: existing?.family ?? TAG_FAMILY,
      unique: existing?.unique ?? 1,
      transform: fromWpiBlue(
        transformFromPose({
          x: num('x'),
          y: num('y'),
          z: num('z'),
          yawDeg: num('yawDeg'),
          pitchDeg: num('pitchDeg'),
          rollDeg: num('rollDeg'),
        }),
        fieldOf(set),
      ),
    };
    const others = set.fiducials.filter((f) => f !== existing);
    await update({ ...set, fiducials: [...others, fiducial].sort((a, b) => a.id - b.id) });
    router.back();
  };

  const confirmDelete = () =>
    Alert.alert('Delete tag?', `Tag ${existing!.id} will be removed from "${set.name}".`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await update({ ...set, fiducials: set.fiducials.filter((f) => f !== existing) });
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Add tag' : `Tag ${existing!.id}` }} />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          {isNew ? (
            <NumberField label="Tag ID" value={draft.id} onChange={set$('id')} error={errors.id} />
          ) : null}
          <NumberField
            label="Size"
            unit="mm"
            value={draft.size}
            onChange={set$('size')}
            error={errors.size}
          />
        </View>
        {[FIELDS.slice(0, 3), FIELDS.slice(3)].map((group, i) => (
          <View key={i} style={styles.row}>
            {group.map(([k, label, unit]) => (
              <NumberField
                key={k}
                label={label}
                unit={unit}
                value={draft[k]}
                onChange={set$(k)}
                error={errors[k]}
              />
            ))}
          </View>
        ))}
        <View style={styles.row}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => router.back()}
            style={styles.flex}
          />
          <Button title="Save" disabled={!valid} onPress={save} style={styles.flex} />
        </View>
        {!isNew ? <Button title="Delete tag" variant="danger" onPress={confirmDelete} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
});

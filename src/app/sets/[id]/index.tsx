import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FieldMap } from '@/components/FieldMap';
import { JsonView } from '@/components/JsonView';
import { useEditableCopy, useSetActions } from '@/components/SetActions';
import { TagTable } from '@/components/TagTable';
import { spacing, useTheme } from '@/components/theme';
import { Placeholder } from '@/components/Placeholder';
import { Button, Screen, SegmentedControl } from '@/components/ui';
import { findSet, useLibrary } from '@/state/library';

type Tab = 'map' | 'table' | 'json';

/** Set detail: Map | Table | JSON (R-5.6.1). */
export default function SetDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userSets = useLibrary((s) => s.userSets);
  const set = findSet(userSets, id);
  const [tab, setTab] = useState<Tab>('map');
  const actions = useSetActions({ onDeleted: () => router.back() });
  const copy = useEditableCopy();

  if (!set) return <Placeholder label="This tag set no longer exists." />;

  const editTag = (tagId: number | 'new') => {
    if (set.builtin) copy.requestCopy(set);
    else router.push(`/sets/${set.id}/edit-tag?tag=${tagId}`);
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: set.name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Actions for ${set.name}`}
              hitSlop={12}
              onPress={() => actions.open(set)}
            >
              <Text style={{ color: t.text, fontSize: 22 }}>⋯</Text>
            </Pressable>
          ),
        }}
      />
      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'map', label: 'Map' },
          { value: 'table', label: 'Table' },
          { value: 'json', label: 'JSON' },
        ]}
      />
      {tab === 'map' ? (
        <ScrollView contentContainerStyle={styles.pad}>
          <FieldMap tags={set.fiducials} field={set.field} onTagPress={editTag} />
          <Text style={{ color: t.muted }}>{set.fiducials.length} tags. Tap a tag to edit it.</Text>
        </ScrollView>
      ) : null}
      {tab === 'table' ? (
        <ScrollView contentContainerStyle={styles.pad}>
          <TagTable fiducials={set.fiducials} onTagPress={editTag} />
        </ScrollView>
      ) : null}
      {tab === 'json' ? <JsonView fiducials={set.fiducials} /> : null}
      <View style={[styles.footer, { borderColor: t.border, backgroundColor: t.surface }]}>
        <Button
          title="Refine"
          onPress={() => router.push(`/scan/session?refine=${set.id}`)}
          style={styles.flex}
        />
        <Button
          title={set.builtin ? 'Edit a copy' : 'Add tag'}
          variant="secondary"
          onPress={() => editTag('new')}
          style={styles.flex}
        />
      </View>
      {actions.element}
      {copy.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: spacing.md, gap: spacing.md },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

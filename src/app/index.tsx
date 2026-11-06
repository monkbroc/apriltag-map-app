import { Stack, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSetActions } from '@/components/SetActions';
import { spacing, useTheme } from '@/components/theme';
import { Button, Screen } from '@/components/ui';
import type { TagSet } from '@/core/types';
import { sortedSets, useLibrary } from '@/state/library';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

/** Tag set library (R-5.1). */
export default function LibraryScreen() {
  const t = useTheme();
  const router = useRouter();
  const userSets = useLibrary((s) => s.userSets);
  const actions = useSetActions();
  const sets = sortedSets(userSets);

  const renderItem = ({ item }: { item: TagSet }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.fiducials.length} tags`}
      onPress={() => router.push(`/sets/${item.id}`)}
      onLongPress={() => actions.open(item)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.flex}>
        <Text style={[styles.name, { color: t.text }]}>{item.name}</Text>
        <Text style={{ color: t.muted }}>
          {item.fiducials.length} tags · {item.builtin ? 'Built-in' : formatDate(item.updatedAt)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Actions for ${item.name}`}
        hitSlop={12}
        onPress={() => actions.open(item)}
        style={styles.more}
      >
        <Text style={{ color: t.text, fontSize: 22 }}>⋯</Text>
      </Pressable>
    </Pressable>
  );

  return (
    <Screen
      footer={
        <>
          <Button title="New scan" onPress={() => router.push('/scan/new')} style={styles.flex} />
          <Button
            title="Import .fmap"
            variant="secondary"
            onPress={() => router.push('/import')}
            style={styles.flex}
          />
        </>
      }
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/licenses')}
              hitSlop={8}
            >
              <Text style={{ color: t.primary }}>About</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={sets}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
      {actions.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 17, fontWeight: '600', marginBottom: 2 },
  more: { paddingHorizontal: spacing.sm },
});

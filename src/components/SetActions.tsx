import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import type { TagSet } from '@/core/types';
import { nameError, uniqueName, useLibrary } from '@/state/library';
import { shareTagSet } from '@/storage/export';

import { ActionMenu, PromptDialog, type MenuItem } from './ui';

/**
 * Per-set actions shared by the library row and the set detail screen (R-5.1.2):
 * Open, Refine, Rename, Delete, Export.
 */
export function useSetActions({ onDeleted }: { onDeleted?: () => void } = {}) {
  const router = useRouter();
  const { userSets, update, remove } = useLibrary();
  const [menuFor, setMenuFor] = useState<TagSet | null>(null);
  const [renaming, setRenaming] = useState<TagSet | null>(null);

  const exportSet = async (set: TagSet) => {
    try {
      await shareTagSet(set);
    } catch (e) {
      Alert.alert('Export failed', String(e instanceof Error ? e.message : e));
    }
  };

  const confirmDelete = (set: TagSet) =>
    Alert.alert('Delete tag set?', `"${set.name}" will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await remove(set.id);
          onDeleted?.();
        },
      },
    ]);

  const items = (set: TagSet, includeOpen: boolean): MenuItem[] => [
    ...(includeOpen ? [{ label: 'Open', onPress: () => router.push(`/sets/${set.id}`) }] : []),
    { label: 'Refine', onPress: () => router.push(`/scan/session?refine=${set.id}`) },
    { label: 'Export .fmap', onPress: () => exportSet(set) },
    { label: 'Rename', disabled: set.builtin, onPress: () => setRenaming(set) },
    {
      label: 'Delete',
      destructive: true,
      disabled: set.builtin,
      onPress: () => confirmDelete(set),
    },
  ];

  const element = (
    <>
      <ActionMenu
        visible={!!menuFor}
        title={menuFor?.name}
        items={menuFor ? items(menuFor, !onDeleted) : []}
        onClose={() => setMenuFor(null)}
      />
      <PromptDialog
        visible={!!renaming}
        title="Rename tag set"
        initialValue={renaming?.name}
        validate={(v) => nameError(v, userSets, renaming?.id)}
        onCancel={() => setRenaming(null)}
        onSubmit={async (name) => {
          if (renaming) await update({ ...renaming, name });
          setRenaming(null);
        }}
      />
    </>
  );

  return { open: setMenuFor, element };
}

/**
 * Built-in sets are read-only: editing one first asks for a name and creates a user copy
 * (R-4.2). Returns a prompt element and a function that resolves to an editable set.
 */
export function useEditableCopy() {
  const router = useRouter();
  const { userSets, create } = useLibrary();
  const [source, setSource] = useState<TagSet | null>(null);

  const element = (
    <PromptDialog
      visible={!!source}
      title="Name your editable copy"
      initialValue={source ? uniqueName(`${source.name} (copy)`, userSets) : ''}
      confirmLabel="Create copy"
      validate={(v) => nameError(v, userSets)}
      onCancel={() => setSource(null)}
      onSubmit={async (name) => {
        if (!source) return;
        const copy = await create(name, source.fiducials, source.field);
        setSource(null);
        router.replace(`/sets/${copy.id}`);
      }}
    />
  );

  return { requestCopy: setSource, element };
}

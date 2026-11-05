import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import type { Fiducial, TagSet } from '@/core/types';
import { builtinSets } from '@/data/builtinSets';
import { deleteTagSet, listTagSets, saveTagSet } from '@/storage/repository';

interface LibraryState {
  loaded: boolean;
  /** User sets only; built-in sets come from `builtinSets`. */
  userSets: TagSet[];
  load: () => Promise<void>;
  /** Create a new user set and return it. */
  create: (name: string, fiducials: Fiducial[], field?: TagSet['field']) => Promise<TagSet>;
  /** Save changes to a user set (bumps `updatedAt`). */
  update: (set: TagSet) => Promise<TagSet>;
  remove: (id: string) => Promise<void>;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  loaded: false,
  userSets: [],

  load: async () => {
    set({ userSets: await listTagSets(), loaded: true });
  },

  create: async (name, fiducials, field) => {
    const now = new Date().toISOString();
    const tagSet: TagSet = {
      schemaVersion: 1,
      id: randomUUID(),
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
      fiducials,
      ...(field ? { field } : {}),
    };
    await saveTagSet(tagSet);
    set({ userSets: [...get().userSets, tagSet] });
    return tagSet;
  },

  update: async (tagSet) => {
    if (tagSet.builtin) throw new Error('Built-in tag sets cannot be changed.');
    const updated = { ...tagSet, name: tagSet.name.trim(), updatedAt: new Date().toISOString() };
    await saveTagSet(updated);
    set({ userSets: get().userSets.map((s) => (s.id === updated.id ? updated : s)) });
    return updated;
  },

  remove: async (id) => {
    deleteTagSet(id);
    set({ userSets: get().userSets.filter((s) => s.id !== id) });
  },
}));

/** Built-in sets first, then user sets newest first (R-5.1.1). */
export function sortedSets(userSets: readonly TagSet[]): TagSet[] {
  return [...builtinSets, ...[...userSets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))];
}

export function findSet(userSets: readonly TagSet[], id: string): TagSet | undefined {
  return builtinSets.find((s) => s.id === id) ?? userSets.find((s) => s.id === id);
}

/** Validation message for a set name, or null when it is fine (R-3.2: required, unique). */
export function nameError(
  name: string,
  userSets: readonly TagSet[],
  excludeId?: string,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name.';
  const clash = userSets.some(
    (s) => s.id !== excludeId && s.name.toLowerCase() === trimmed.toLowerCase(),
  );
  return clash ? 'Another tag set already has this name.' : null;
}

/** A name like "<base> (2)" that does not clash with existing user sets. */
export function uniqueName(base: string, userSets: readonly TagSet[]): string {
  if (!nameError(base, userSets)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})`;
    if (!nameError(candidate, userSets)) return candidate;
  }
}

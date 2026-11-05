import { Directory, File, Paths } from 'expo-file-system';

import type { TagSet } from '@/core/types';

/**
 * One JSON file per user tag set in `<documents>/tagsets/` (R-6.2). The library is built
 * by listing that folder.
 */
function folder(): Directory {
  const dir = new Directory(Paths.document, 'tagsets');
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function fileFor(id: string): File {
  return new File(folder(), `${id}.json`);
}

function isTagSet(value: unknown): value is TagSet {
  const v = value as Partial<TagSet> | null;
  return (
    !!v &&
    v.schemaVersion === 1 &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.fiducials)
  );
}

export async function listTagSets(): Promise<TagSet[]> {
  const out: TagSet[] = [];
  for (const entry of folder().list()) {
    if (!(entry instanceof File) || !entry.name.endsWith('.json')) continue;
    try {
      const parsed: unknown = JSON.parse(await entry.text());
      if (isTagSet(parsed)) out.push(parsed);
      else console.warn(`Skipping unrecognized tag set file ${entry.name}`);
    } catch (e) {
      console.warn(`Skipping unreadable tag set file ${entry.name}`, e);
    }
  }
  return out;
}

export async function saveTagSet(set: TagSet): Promise<void> {
  const file = fileFor(set.id);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(set));
}

export function deleteTagSet(id: string): void {
  const file = fileFor(id);
  if (file.exists) file.delete();
}

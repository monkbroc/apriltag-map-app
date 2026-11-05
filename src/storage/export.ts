import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { fmapFileName, serializeFmap } from '@/core/fmap';
import type { TagSet } from '@/core/types';

/** Write `<name>.fmap` to the cache and open the share sheet (R-5.9.1). */
export async function shareTagSet(set: TagSet): Promise<void> {
  const file = new File(Paths.cache, fmapFileName(set.name));
  file.create({ overwrite: true });
  await file.write(serializeFmap(set.fiducials));
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: `Export ${set.name}`,
    UTI: 'public.json',
  });
}

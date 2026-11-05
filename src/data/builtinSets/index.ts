/**
 * Built-in, read-only tag sets (R-4). To add a season:
 *   1. node scripts/convert-wpilib-layout.mjs <wpilib layout.json> src/data/builtinSets/<name>.fmap.json
 *   2. add an entry below.
 */
import { parseFmap } from '@/core/fmap';
import type { TagSet } from '@/core/types';

import frc2026 from './frc2026.fmap.json';

interface BuiltinSource {
  id: string;
  name: string;
  fmap: unknown;
  field: { lengthM: number; widthM: number };
}

const sources: BuiltinSource[] = [
  {
    // Source: WPILib v2026.2.2 2026-rebuilt-welded.json (BSD-3-Clause), converted to field center.
    id: 'builtin-frc2026',
    name: 'FRC 2026',
    fmap: frc2026,
    field: { lengthM: 16.541, widthM: 8.069 },
  },
];

const EPOCH = '2026-01-01T00:00:00.000Z';

function load(source: BuiltinSource): TagSet {
  const parsed = parseFmap(JSON.stringify(source.fmap));
  if (!parsed.ok) {
    throw new Error(`Built-in set ${source.name} is invalid: ${parsed.errors.join('; ')}`);
  }
  return {
    schemaVersion: 1,
    id: source.id,
    name: source.name,
    createdAt: EPOCH,
    updatedAt: EPOCH,
    builtin: true,
    field: source.field,
    fiducials: parsed.doc.fiducials,
  };
}

export const builtinSets: readonly TagSet[] = sources.map(load);

export function isBuiltinId(id: string): boolean {
  return builtinSets.some((s) => s.id === id);
}

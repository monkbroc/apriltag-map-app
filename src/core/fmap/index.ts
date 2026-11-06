import { z } from 'zod';

import { MAP_TYPE, TAG_FAMILY } from '../config';
import {
  mat4FromRT,
  orthonormalityError,
  orthonormalize,
  rotationOf,
  translationOf,
} from '../math';
import type { Fiducial, FmapDoc } from '../types';

/** Rotations further than this from orthonormal are rejected on import (R-5.9.3). */
export const ORTHONORMAL_TOLERANCE = 1e-3;

const fiducialSchema = z.object({
  family: z.string(),
  id: z.number().int().nonnegative(),
  size: z.number().positive(),
  transform: z.array(z.number()).length(16),
  // The spec example uses 1; Limelight's downloadable maps use true.
  unique: z.union([z.number().int(), z.boolean()]).optional(),
});

const fmapSchema = z.object({
  type: z.string(),
  fiducials: z.array(fiducialSchema),
});

export type ParseResult = { ok: true; doc: FmapDoc } | { ok: false; errors: string[] };

/** Parse and validate .fmap text (R-3.1, R-5.9.3). */
export function parseFmap(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }

  const parsed = fmapSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const where = issue.path.length ? issue.path.join('.') : 'file';
        return `${where}: ${issue.message}`;
      }),
    };
  }

  const errors: string[] = [];
  const { type, fiducials } = parsed.data;
  if (type !== MAP_TYPE) {
    errors.push(`Map type "${type}" is not supported. Only "${MAP_TYPE}" maps can be imported.`);
  }

  const seen = new Set<number>();
  const out: Fiducial[] = [];
  for (const f of fiducials) {
    const label = `Tag ${f.id}`;
    const unique = f.unique === undefined ? 1 : Number(f.unique);
    if (f.family !== TAG_FAMILY) {
      errors.push(`${label}: family "${f.family}" is not supported (expected "${TAG_FAMILY}").`);
    }
    if (unique === 1 && seen.has(f.id)) errors.push(`${label}: duplicate tag ID.`);
    seen.add(f.id);

    const [m12, m13, m14, m15] = f.transform.slice(12);
    if (m12 !== 0 || m13 !== 0 || m14 !== 0 || m15 !== 1) {
      errors.push(`${label}: the last row of the transform must be 0, 0, 0, 1.`);
      continue;
    }
    const r = rotationOf(f.transform);
    if (orthonormalityError(r) > ORTHONORMAL_TOLERANCE) {
      errors.push(`${label}: the transform rotation is not a valid rotation matrix.`);
      continue;
    }
    out.push({
      id: f.id,
      size: f.size,
      family: f.family,
      unique,
      transform: mat4FromRT(orthonormalize(r), translationOf(f.transform)),
    });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, doc: { type, fiducials: out } };
}

function round6(v: number): number {
  const r = Math.round(v * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}

/** Serialize to .fmap text (R-3.1.7, R-3.1.8). App-only metadata is dropped. */
export function serializeFmap(fiducials: readonly Fiducial[]): string {
  const sorted = [...fiducials].sort((a, b) => a.id - b.id);
  const entries = sorted.map((f) => {
    const t = mat4FromRT(orthonormalize(rotationOf(f.transform)), translationOf(f.transform)).map(
      round6,
    );
    const rows = [0, 4, 8, 12].map((i) => '        ' + t.slice(i, i + 4).join(', ')).join(',\n');
    return [
      '    {',
      `      "family": ${JSON.stringify(f.family)},`,
      `      "id": ${f.id},`,
      `      "size": ${round6(f.size)},`,
      `      "transform": [\n${rows}\n      ],`,
      `      "unique": ${f.unique}`,
      '    }',
    ].join('\n');
  });
  const body = entries.length ? `[\n${entries.join(',\n')}\n  ]` : '[]';
  return `{\n  "type": ${JSON.stringify(MAP_TYPE)},\n  "fiducials": ${body}\n}\n`;
}

/** File-system-safe file name for a tag set (R-5.9.1). */
export function fmapFileName(name: string): string {
  const safe = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return `${safe || 'tagset'}.fmap`;
}

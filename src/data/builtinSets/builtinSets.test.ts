import { builtinSets, isBuiltinId } from '.';
import { parseFmap, serializeFmap } from '@/core/fmap';
import { apply3, rotationOf, translationOf } from '@/core/math';

import wpilib from '../../../scripts/data/wpilib-2026-rebuilt-welded.json';

const frc2026 = builtinSets.find((s) => s.id === 'builtin-frc2026')!;
const tag = (id: number) => frc2026.fiducials.find((f) => f.id === id)!;

describe('FRC 2026 built-in set', () => {
  it('has all 32 tags at 165.1 mm', () => {
    expect(frc2026.fiducials.map((f) => f.id)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(frc2026.fiducials.every((f) => f.size === 165.1)).toBe(true);
    expect(isBuiltinId(frc2026.id)).toBe(true);
    expect(isBuiltinId('something-else')).toBe(false);
  });

  it('matches the WPILib layout shifted to a field-center origin', () => {
    const { length, width } = wpilib.field;
    for (const w of wpilib.tags) {
      const [x, y, z] = translationOf(tag(w.ID).transform);
      expect(x).toBeCloseTo(w.pose.translation.x - length / 2, 5);
      expect(y).toBeCloseTo(w.pose.translation.y - width / 2, 5);
      expect(z).toBeCloseTo(w.pose.translation.z, 5);
    }
  });

  it('keeps tags inside the field', () => {
    for (const f of frc2026.fiducials) {
      const [x, y] = translationOf(f.transform);
      expect(Math.abs(x)).toBeLessThanOrEqual(frc2026.field!.lengthM / 2);
      expect(Math.abs(y)).toBeLessThanOrEqual(frc2026.field!.widthM / 2);
    }
  });

  it('uses the .fmap tag axes: +X out of the tag face, +Z up (R-3.3.2)', () => {
    // Tag 1 is on the red half of the field and faces the blue alliance (-X).
    const t1 = tag(1);
    expect(translationOf(t1.transform)[0]).toBeGreaterThan(0);
    const normal = apply3(rotationOf(t1.transform), [1, 0, 0]);
    expect(normal[0]).toBeCloseTo(-1, 6);
    expect(apply3(rotationOf(t1.transform), [0, 0, 1])[2]).toBeCloseTo(1, 6);
  });

  it('survives a serialize/parse round trip unchanged', () => {
    const again = parseFmap(serializeFmap(frc2026.fiducials));
    if (!again.ok) throw new Error(again.errors.join());
    expect(again.doc.fiducials).toEqual(frc2026.fiducials);
  });
});

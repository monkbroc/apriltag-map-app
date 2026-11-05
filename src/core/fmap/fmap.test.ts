import { fmapFileName, parseFmap, serializeFmap } from '.';
import { TAG_FAMILY } from '../config';
import { mat3FromEuler, mat4FromRT, orthonormalityError, rotationOf } from '../math';
import type { Fiducial } from '../types';

function tag(id: number, yawDeg = 0, t: [number, number, number] = [1, 2, 0.5]): Fiducial {
  return {
    id,
    size: 165.1,
    family: TAG_FAMILY,
    unique: 1,
    transform: mat4FromRT(mat3FromEuler({ yawDeg, pitchDeg: 0, rollDeg: 0 }), t),
  };
}

function docText(fiducials: unknown[], type = 'frc') {
  return JSON.stringify({ type, fiducials });
}

describe('serializeFmap', () => {
  it('writes sorted, rounded, pretty JSON without app metadata', () => {
    const text = serializeFmap([
      { ...tag(5, 90, [1.23456789, -0.0000001, 2]), observationCount: 12 },
      tag(2),
    ]);
    const json = JSON.parse(text);
    expect(json.type).toBe('frc');
    expect(json.fiducials.map((f: Fiducial) => f.id)).toEqual([2, 5]);
    expect(json.fiducials[1].transform[3]).toBe(1.234568);
    expect(Object.is(json.fiducials[1].transform[7], -0)).toBe(false);
    expect(json.fiducials[1]).not.toHaveProperty('observationCount');
    expect(text).toContain('\n  "fiducials": [\n    {\n      "family"');
  });

  it('writes an empty list', () => {
    expect(JSON.parse(serializeFmap([]))).toEqual({ type: 'frc', fiducials: [] });
  });

  it('round-trips through parseFmap', () => {
    const original = [tag(1, 30), tag(7, -120, [-3, 4, 1.2])];
    const parsed = parseFmap(serializeFmap(original));
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
    parsed.doc.fiducials.forEach((f, i) => {
      const o = original[i]!;
      expect(f.id).toBe(o.id);
      f.transform.forEach((v, j) => expect(v).toBeCloseTo(o.transform[j]!, 5));
      expect(orthonormalityError(rotationOf(f.transform))).toBeLessThan(1e-9);
    });
  });
});

describe('parseFmap', () => {
  it('accepts a valid file and defaults unique to 1', () => {
    const { unique: _unique, ...noUnique } = tag(3);
    const r = parseFmap(docText([noUnique]));
    expect(r.ok && r.doc.fiducials[0]!.unique).toBe(1);
  });

  it('silently re-orthonormalizes rotations within tolerance', () => {
    const t = [...tag(1, 10).transform];
    t[0] = t[0]! + 1e-4;
    const r = parseFmap(docText([{ ...tag(1), transform: t }]));
    if (!r.ok) throw new Error(r.errors.join());
    expect(orthonormalityError(rotationOf(r.doc.fiducials[0]!.transform))).toBeLessThan(1e-12);
  });

  const reject: [string, string, RegExp][] = [
    ['invalid JSON', '{nope', /not valid JSON/],
    ['missing keys', JSON.stringify({ type: 'frc' }), /fiducials/],
    ['wrong type', docText([tag(1)], 'ftc'), /"ftc" is not supported/],
    ['wrong family', docText([{ ...tag(1), family: 'tag16h5' }]), /Tag 1: family/],
    ['duplicate ids', docText([tag(4), tag(4)]), /Tag 4: duplicate/],
    ['short transform', docText([{ ...tag(1), transform: [1, 2, 3] }]), /transform/],
    [
      'bad bottom row',
      docText([{ ...tag(1), transform: [...tag(1).transform.slice(0, 15), 2] }]),
      /last row/,
    ],
    [
      'non-orthonormal rotation',
      docText([{ ...tag(1), transform: [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }]),
      /not a valid rotation/,
    ],
    ['negative id', docText([{ ...tag(1), id: -1 }]), /id/],
  ];
  it.each(reject)('rejects %s', (_name, text, message) => {
    const r = parseFmap(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(message);
  });

  it('allows repeated ids when unique is 0', () => {
    const r = parseFmap(
      docText([
        { ...tag(4), unique: 0 },
        { ...tag(4), unique: 0 },
      ]),
    );
    expect(r.ok).toBe(true);
  });
});

describe('fmapFileName', () => {
  it('sanitizes names', () => {
    expect(fmapFileName('FRC 2026: refined/v2')).toBe('FRC 2026_ refined_v2.fmap');
    expect(fmapFileName('  ..  ')).toBe('tagset.fmap');
  });
});

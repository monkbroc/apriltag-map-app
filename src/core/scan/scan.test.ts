import { APRILTAG_TO_FMAP_TAG, ScanAccumulator, acceptObservation, fromAprilTagFrame } from '.';
import type { Observation } from '.';
import {
  IDENTITY4,
  apply3,
  det3,
  mat3FromEuler,
  mat4FromRT,
  norm,
  rotationAngleDeg,
  rotationOf,
  sub,
  translationOf,
  type Mat4,
} from '../math';
import { expectMatClose, gaussian, rng } from '../testUtils';

function obs(tagId: number, worldFromTag: Mat4, over: Partial<Observation> = {}): Observation {
  return {
    tagId,
    worldFromTag,
    decisionMargin: 80,
    pixelSize: 100,
    viewAngleDeg: 10,
    hamming: 0,
    trackingNormal: true,
    timestamp: 0,
    ...over,
  };
}

describe('acceptObservation', () => {
  const good = obs(1, IDENTITY4);
  it('accepts a good observation', () => expect(acceptObservation(good)).toBe(true));
  it.each<[string, Partial<Observation>]>([
    ['limited tracking', { trackingNormal: false }],
    ['low decision margin', { decisionMargin: 5 }],
    ['small tag', { pixelSize: 10 }],
    ['steep view angle', { viewAngleDeg: 75 }],
    ['corrected bits', { hamming: 1 }],
  ])('rejects %s', (_name, over) => expect(acceptObservation({ ...good, ...over })).toBe(false));
});

describe('APRILTAG_TO_FMAP_TAG', () => {
  it('is a proper rotation', () => expect(det3(APRILTAG_TO_FMAP_TAG)).toBeCloseTo(1, 12));

  it('maps .fmap axes onto the AprilTag frame', () => {
    // .fmap +X (out of the tag, toward the viewer) is AprilTag -Z.
    expectMatClose(apply3(APRILTAG_TO_FMAP_TAG, [1, 0, 0]), [0, 0, -1]);
    // .fmap +Y (viewer's right) is AprilTag +X.
    expectMatClose(apply3(APRILTAG_TO_FMAP_TAG, [0, 1, 0]), [1, 0, 0]);
    // .fmap +Z (up) is AprilTag -Y.
    expectMatClose(apply3(APRILTAG_TO_FMAP_TAG, [0, 0, 1]), [0, -1, 0]);
  });

  it('keeps the translation when converting frames', () => {
    const t = mat4FromRT(mat3FromEuler({ yawDeg: 10, pitchDeg: 0, rollDeg: 0 }), [1, 2, 3]);
    expect(translationOf(fromAprilTagFrame(t))).toEqual([1, 2, 3]);
  });
});

describe('ScanAccumulator', () => {
  it('averages noisy observations close to the true pose', () => {
    const rand = rng(3);
    const truth = mat4FromRT(mat3FromEuler({ yawDeg: 170, pitchDeg: 5, rollDeg: -3 }), [2, 1, -4]);
    const acc = new ScanAccumulator();
    for (let i = 0; i < 300; i++) {
      const r = mat3FromEuler({
        yawDeg: 170 + gaussian(rand, 1),
        pitchDeg: 5 + gaussian(rand, 1),
        rollDeg: -3 + gaussian(rand, 1),
      });
      const t = translationOf(truth).map((v) => v + gaussian(rand, 0.01)) as [
        number,
        number,
        number,
      ];
      acc.add(obs(9, mat4FromRT(r, t)));
    }
    const [result] = acc.results();
    expect(result!.count).toBe(300);
    expect(norm(sub(translationOf(result!.worldFromTag), translationOf(truth)))).toBeLessThan(
      0.003,
    );
    expect(rotationAngleDeg(rotationOf(result!.worldFromTag), rotationOf(truth))).toBeLessThan(0.3);
  });

  it('handles quaternion sign flips (rotations near 180°)', () => {
    const acc = new ScanAccumulator();
    acc.add(obs(1, mat4FromRT(mat3FromEuler({ yawDeg: 179, pitchDeg: 0, rollDeg: 0 }), [0, 0, 0])));
    acc.add(
      obs(1, mat4FromRT(mat3FromEuler({ yawDeg: -179, pitchDeg: 0, rollDeg: 0 }), [0, 0, 0])),
    );
    const r = rotationOf(acc.results()[0]!.worldFromTag);
    expect(
      rotationAngleDeg(r, mat3FromEuler({ yawDeg: 180, pitchDeg: 0, rollDeg: 0 })),
    ).toBeLessThan(1e-6);
  });

  it('skips rejected observations and tracks counts per tag', () => {
    const acc = new ScanAccumulator();
    expect(acc.add(obs(2, IDENTITY4))).toBe(true);
    expect(acc.add(obs(2, IDENTITY4, { hamming: 2 }))).toBe(false);
    acc.add(obs(5, IDENTITY4));
    acc.add(obs(5, IDENTITY4));
    expect(acc.count(2)).toBe(1);
    expect(acc.count(3)).toBe(0);
    expect([...acc.counts()]).toEqual([
      [2, 1],
      [5, 2],
    ]);
    expect(acc.results().map((r) => r.tagId)).toEqual([2, 5]);
    acc.reset();
    expect(acc.results()).toEqual([]);
  });
});

import { AR_CAMERA_FROM_CV_CAMERA, observationsFromFrame } from './frames';
import { IDENTITY4, apply3, mat4FromRT, rotationOf, translationOf } from './math';
import { expectMatClose } from './testUtils';

const cvFacingTag = (d: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, d, 0, 0, 0, 1];

describe('observationsFromFrame', () => {
  it('places a tag straight ahead of an identity AR camera at -Z', () => {
    // ARKit/ARCore cameras look down their -Z axis.
    const [o] = observationsFromFrame({
      timestamp: 1,
      tracking: 'normal',
      worldFromCamera: IDENTITY4,
      detections: [
        {
          id: 3,
          hamming: 0,
          decisionMargin: 90,
          pixelSize: 80,
          viewAngleDeg: 0,
          cameraFromTag: cvFacingTag(2),
        },
      ],
    });
    expectMatClose(translationOf(o!.worldFromTag), [0, 0, -2]);
    // The .fmap tag normal (+X) points back at the camera (+Z), and tag up (+Z) is AR up (+Y).
    const r = rotationOf(o!.worldFromTag);
    expectMatClose(apply3(r, [1, 0, 0]), [0, 0, 1]);
    expectMatClose(apply3(r, [0, 0, 1]), [0, 1, 0]);
    expect(o).toMatchObject({ tagId: 3, trackingNormal: true, timestamp: 1, decisionMargin: 90 });
  });

  it('applies the camera pose and reports limited tracking', () => {
    const worldFromCamera = mat4FromRT([1, 0, 0, 0, 1, 0, 0, 0, 1], [5, 1, 0]);
    const [o] = observationsFromFrame({
      timestamp: 2,
      tracking: 'limited',
      worldFromCamera,
      detections: [
        {
          id: 1,
          hamming: 0,
          decisionMargin: 50,
          pixelSize: 40,
          viewAngleDeg: 5,
          cameraFromTag: cvFacingTag(1),
        },
      ],
    });
    expectMatClose(translationOf(o!.worldFromTag), [5, 1, -1]);
    expect(o!.trackingNormal).toBe(false);
  });

  it('flips y and z between camera conventions', () => {
    expectMatClose(apply3(rotationOf(AR_CAMERA_FROM_CV_CAMERA), [0, 1, 1]), [0, -1, -1]);
  });
});

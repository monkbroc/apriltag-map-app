import { fieldToScreen, fit, hitTest, zoomAbout } from './mapView';

const bounds = { halfX: 10, halfY: 5 }; // 20 m x 10 m viewBox
const layout = { width: 400, height: 400 }; // square container: 20 px per meter, letterboxed
const identity = { tx: 0, ty: 0, scale: 1 };

describe('map view geometry', () => {
  it('letterboxes the viewBox inside the container', () => {
    expect(fit(bounds, layout)).toEqual({ k: 20, ox: 0, oy: 100 });
  });

  it('maps field points to screen with +Y up', () => {
    expect(fieldToScreen(0, 0, bounds, layout, identity)).toEqual([200, 200]);
    expect(fieldToScreen(-10, 5, bounds, layout, identity)).toEqual([0, 100]);
    expect(fieldToScreen(0, 0, bounds, layout, { tx: 10, ty: -20, scale: 2 })).toEqual([410, 380]);
  });

  it('zooms about the focal point', () => {
    const z = zoomAbout(identity, 2, 200, 200);
    expect(z).toEqual({ scale: 2, tx: -200, ty: -200 });
    expect(fieldToScreen(0, 0, bounds, layout, z)).toEqual([200, 200]);
  });

  describe('hitTest', () => {
    const tags = [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 0.5, y: 0 },
    ];
    it('picks the nearest tag within the hit radius', () => {
      // 0.4 m hit radius = 8 px at scale 1. Tag 2 is 10 px right of tag 1.
      expect(hitTest(203, 200, tags, bounds, layout, identity, 0.4)).toBe(1);
      expect(hitTest(208, 200, tags, bounds, layout, identity, 0.4)).toBe(2);
      expect(hitTest(200, 230, tags, bounds, layout, identity, 0.4)).toBeNull();
    });

    it('grows the hit area with zoom', () => {
      // 30 px below tag 1 misses at 1x (8 px radius) but hits at 4x (32 px radius).
      const z = zoomAbout(identity, 4, 200, 200);
      expect(hitTest(200, 230, tags, bounds, layout, z, 0.4)).toBe(1);
    });
  });
});

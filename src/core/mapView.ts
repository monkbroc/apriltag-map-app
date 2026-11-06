/**
 * Geometry for the zoomable top-down map: field-centered meters ↔ SVG viewBox units ↔ screen
 * pixels, and hit-testing taps against tag markers at the current zoom.
 */

export interface MapBounds {
  /** Half the viewBox width/height in meters, centered on the field origin. */
  halfX: number;
  halfY: number;
}

export interface ViewTransform {
  /** Pan (screen px) and zoom applied to the whole map, with the origin at the top-left. */
  tx: number;
  ty: number;
  scale: number;
}

export interface Layout {
  width: number;
  height: number;
}

/** viewBox → container pixels with preserveAspectRatio="xMidYMid meet". */
export function fit(bounds: MapBounds, layout: Layout) {
  const vbW = bounds.halfX * 2;
  const vbH = bounds.halfY * 2;
  const k = Math.min(layout.width / vbW, layout.height / vbH);
  return { k, ox: (layout.width - vbW * k) / 2, oy: (layout.height - vbH * k) / 2 };
}

/** Screen pixel of a field-centered point at the current zoom. */
export function fieldToScreen(
  x: number,
  y: number,
  bounds: MapBounds,
  layout: Layout,
  view: ViewTransform,
): [number, number] {
  const { k, ox, oy } = fit(bounds, layout);
  const lx = ox + (x + bounds.halfX) * k;
  const ly = oy + (bounds.halfY - y) * k;
  return [view.tx + lx * view.scale, view.ty + ly * view.scale];
}

/**
 * The tag nearest to a tap, if it is within `hitRadiusM` meters (on the map) of the tap. The
 * radius is in map units, so the hit area grows with the marker as you zoom in.
 */
export function hitTest(
  screenX: number,
  screenY: number,
  tags: readonly { id: number; x: number; y: number }[],
  bounds: MapBounds,
  layout: Layout,
  view: ViewTransform,
  hitRadiusM: number,
): number | null {
  const { k } = fit(bounds, layout);
  const hitPx = hitRadiusM * k * view.scale;
  let best: { id: number; d: number } | null = null;
  for (const tag of tags) {
    const [px, py] = fieldToScreen(tag.x, tag.y, bounds, layout, view);
    const d = Math.hypot(px - screenX, py - screenY);
    if (d <= hitPx && (!best || d < best.d)) best = { id: tag.id, d };
  }
  return best?.id ?? null;
}

/** New pan so the point under `focal` stays put when zooming from `from` to `toScale`. */
export function zoomAbout(
  from: ViewTransform,
  toScale: number,
  focalX: number,
  focalY: number,
): ViewTransform {
  'worklet';
  const r = toScale / from.scale;
  return {
    scale: toScale,
    tx: focalX - (focalX - from.tx) * r,
    ty: focalY - (focalY - from.ty) * r,
  };
}

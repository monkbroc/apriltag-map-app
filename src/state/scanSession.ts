import { create } from 'zustand';

import { observationsFromFrame, type FrameLike } from '@/core/frames';
import type { PoseFields } from '@/core/pose';
import { ScanAccumulator, type AggregatedTag } from '@/core/scan';

export type ScanMode = 'fresh' | 'refine';

export interface OverlayTag {
  id: number;
  /** Corners normalized to the view (0..1). */
  corners: number[];
}

interface ScanSessionState {
  mode: ScanMode;
  /** Reference/baseline set for refine mode. */
  referenceSetId: string | null;
  /** Accepted observations per tag. */
  counts: Record<number, number>;
  tracking: FrameLike['tracking'];
  trackingReason?: string;
  overlay: OverlayTag[];
  paused: boolean;
  /** Tags excluded from the alignment fit (R-5.4.4). */
  excludedIds: number[];
  /** Fresh mode: hand-entered field poses of the reference tags (R-5.4.2). */
  freshReferences: Record<number, PoseFields>;

  start: (mode: ScanMode, referenceSetId?: string) => void;
  ingestFrame: (frame: FrameLike) => void;
  setPaused: (paused: boolean) => void;
  toggleExcluded: (id: number) => void;
  setFreshReference: (id: number, pose: PoseFields | null) => void;
  /** Averaged poses in the AR world frame. */
  aggregated: () => AggregatedTag[];
}

// The accumulator is mutable and large, so it lives outside the reactive state.
const accumulator = new ScanAccumulator();

const initial = {
  mode: 'fresh' as ScanMode,
  referenceSetId: null,
  counts: {},
  tracking: 'notAvailable' as const,
  trackingReason: undefined,
  overlay: [],
  paused: false,
  excludedIds: [],
  freshReferences: {},
};

export const useScanSession = create<ScanSessionState>((set, get) => ({
  ...initial,

  start: (mode, referenceSetId) => {
    accumulator.reset();
    set({ ...initial, mode, referenceSetId: referenceSetId ?? null });
  },

  ingestFrame: (frame) => {
    const { paused } = get();
    const overlay = frame.detections.map((d) => ({ id: d.id, corners: [...(d.corners ?? [])] }));
    if (!paused) {
      for (const o of observationsFromFrame(frame)) accumulator.add(o);
    }
    set({
      tracking: frame.tracking,
      trackingReason: frame.trackingReason,
      overlay,
      counts: Object.fromEntries(accumulator.counts()),
    });
  },

  setPaused: (paused) => set({ paused }),

  toggleExcluded: (id) =>
    set((s) => ({
      excludedIds: s.excludedIds.includes(id)
        ? s.excludedIds.filter((x) => x !== id)
        : [...s.excludedIds, id],
    })),

  setFreshReference: (id, pose) =>
    set((s) => {
      const next = { ...s.freshReferences };
      if (pose) next[id] = pose;
      else delete next[id];
      return { freshReferences: next };
    }),

  aggregated: () => accumulator.results(),
}));

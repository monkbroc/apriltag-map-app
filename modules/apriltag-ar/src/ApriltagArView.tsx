import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';

import type { ApriltagArViewProps } from './ApriltagAr.types';

const NativeView: ComponentType<ApriltagArViewProps> = requireNativeView('ApriltagAr');

/** Full-screen AR camera view that emits AprilTag detections. */
export default function ApriltagArView(props: ApriltagArViewProps) {
  return <NativeView {...props} />;
}

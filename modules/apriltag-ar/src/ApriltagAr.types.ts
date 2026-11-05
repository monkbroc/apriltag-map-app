import type { StyleProp, ViewStyle } from 'react-native';

export type TrackingState = 'normal' | 'limited' | 'notAvailable';

/** One tag detected in one camera frame. */
export interface NativeDetection {
  id: number;
  hamming: number;
  decisionMargin: number;
  /** Shortest side of the detected quad, in image pixels. */
  pixelSize: number;
  /** Angle between the camera ray and the tag normal, in degrees. */
  viewAngleDeg: number;
  /**
   * Tag pose relative to the camera, row-major 4x4, meters. Camera axes are the computer-vision
   * convention (x right, y down, z forward, aligned with the image sensor); tag axes are the
   * AprilTag library's (x right, y down, z into the tag).
   */
  cameraFromTag: number[];
  /** Quad corners x0,y0..x3,y3 normalized to the view (0..1). */
  corners: number[];
}

export interface FrameEvent {
  timestamp: number;
  tracking: TrackingState;
  /** Why tracking is limited, when it is. */
  trackingReason?: string;
  /**
   * Camera pose in the AR world frame (gravity-aligned, +Y up), row-major 4x4. Camera axes are the
   * AR convention (x right, y up, z backward, aligned with the image sensor).
   */
  worldFromCamera: number[];
  detections: NativeDetection[];
}

export interface ErrorEvent {
  message: string;
}

export interface ApriltagArViewProps {
  style?: StyleProp<ViewStyle>;
  /** Pause the AR session and detection. */
  paused?: boolean;
  /** Physical tag size (black border edge), meters. */
  tagSizeM?: number;
  /** Maximum detection rate. */
  maxRateHz?: number;
  onFrame?: (event: { nativeEvent: FrameEvent }) => void;
  onError?: (event: { nativeEvent: ErrorEvent }) => void;
}

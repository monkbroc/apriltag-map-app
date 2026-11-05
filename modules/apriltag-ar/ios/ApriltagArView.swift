import ARKit
import ExpoModulesCore
import UIKit

/// Shows the ARKit camera feed and runs the AprilTag detector on frames at up to `maxRateHz`.
/// Each processed frame is sent to JS as `onFrame` with the camera pose and the detections.
class ApriltagArView: ExpoView, ARSessionDelegate {
  let onFrame = EventDispatcher()
  let onError = EventDispatcher()

  var tagSizeM: Double = 0.1651
  var maxRateHz: Double = 10

  private let sceneView = ARSCNView()
  private let queue = DispatchQueue(label: "apriltag-ar.detect", qos: .userInitiated)
  private var detector: OpaquePointer?
  private var paused = false
  private var running = false
  private var busy = false
  private var lastProcessed: TimeInterval = 0
  private static let maxDetections = 32

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    sceneView.automaticallyUpdatesLighting = false
    sceneView.session.delegate = self
    addSubview(sceneView)
    let threads = Int32(max(2, min(4, ProcessInfo.processInfo.activeProcessorCount - 2)))
    detector = atag_create(2.0, threads)
  }

  deinit {
    sceneView.session.pause()
    if let detector {
      queue.async { atag_destroy(detector) }
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    sceneView.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    updateSession()
  }

  func setPaused(_ value: Bool) {
    paused = value
    updateSession()
  }

  private func updateSession() {
    let shouldRun = window != nil && !paused
    if shouldRun && !running {
      guard ARWorldTrackingConfiguration.isSupported else {
        onError(["message": "This device does not support ARKit world tracking."])
        return
      }
      let config = ARWorldTrackingConfiguration()
      config.worldAlignment = .gravity
      sceneView.session.run(config)
      running = true
    } else if !shouldRun && running {
      sceneView.session.pause()
      running = false
    }
  }

  // MARK: - ARSessionDelegate (called on the main queue)

  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    guard !busy, frame.timestamp - lastProcessed >= 1 / maxRateHz, let detector else { return }
    busy = true
    lastProcessed = frame.timestamp

    let orientation = window?.windowScene?.interfaceOrientation ?? .portrait
    let viewport = bounds.size
    let display = frame.displayTransform(for: orientation, viewportSize: viewport)
    let pixelBuffer = frame.capturedImage
    let intrinsics = frame.camera.intrinsics
    let worldFromCamera = Self.rowMajor(frame.camera.transform)
    let (tracking, reason) = Self.describe(frame.camera.trackingState)
    let timestamp = frame.timestamp
    let tagSize = tagSizeM

    queue.async { [weak self] in
      let detections = Self.detect(
        detector: detector, pixelBuffer: pixelBuffer, intrinsics: intrinsics, tagSizeM: tagSize,
        display: display)
      DispatchQueue.main.async {
        guard let self else { return }
        var event: [String: Any] = [
          "timestamp": timestamp,
          "tracking": tracking,
          "worldFromCamera": worldFromCamera,
          "detections": detections,
        ]
        if let reason { event["trackingReason"] = reason }
        self.onFrame(event)
        self.busy = false
      }
    }
  }

  func session(_ session: ARSession, didFailWithError error: Error) {
    running = false
    onError(["message": error.localizedDescription])
  }

  // MARK: - Detection (runs on `queue`)

  private static func detect(
    detector: OpaquePointer, pixelBuffer: CVPixelBuffer, intrinsics: simd_float3x3,
    tagSizeM: Double, display: CGAffineTransform
  ) -> [[String: Any]] {
    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0) else { return [] }
    let width = CVPixelBufferGetWidthOfPlane(pixelBuffer, 0)
    let height = CVPixelBufferGetHeightOfPlane(pixelBuffer, 0)
    let stride = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)

    // simd matrices are column-major: intrinsics[column][row].
    let fx = Double(intrinsics[0][0])
    let fy = Double(intrinsics[1][1])
    let cx = Double(intrinsics[2][0])
    let cy = Double(intrinsics[2][1])

    var out = [atag_detection](repeating: atag_detection(), count: maxDetections)
    let n = Int(
      atag_detect(
        detector, base.assumingMemoryBound(to: UInt8.self), Int32(width), Int32(height),
        Int32(stride), fx, fy, cx, cy, tagSizeM, &out, Int32(maxDetections)))

    return (0..<n).map { i in
      var d = out[i]
      let r = doubles(&d.rotation, count: 9)
      let t = doubles(&d.translation, count: 3)
      let px = doubles(&d.corners, count: 8)
      var corners: [Double] = []
      for c in 0..<4 {
        let p = CGPoint(x: px[2 * c] / Double(width), y: px[2 * c + 1] / Double(height))
          .applying(display)
        corners += [Double(p.x), Double(p.y)]
      }
      return [
        "id": Int(d.id),
        "hamming": Int(d.hamming),
        "decisionMargin": Double(d.decision_margin),
        "pixelSize": d.pixel_size,
        "viewAngleDeg": d.view_angle_deg,
        "cameraFromTag": [r[0], r[1], r[2], t[0], r[3], r[4], r[5], t[1], r[6], r[7], r[8], t[2], 0, 0, 0, 1],
        "corners": corners,
      ]
    }
  }

  /// Copy a C fixed-size array (imported as a tuple) into a Swift array.
  private static func doubles<T>(_ tuple: inout T, count: Int) -> [Double] {
    withUnsafeBytes(of: &tuple) { Array($0.bindMemory(to: Double.self).prefix(count)) }
  }

  private static func rowMajor(_ m: simd_float4x4) -> [Double] {
    var out: [Double] = []
    for row in 0..<4 {
      for col in 0..<4 { out.append(Double(m[col][row])) }
    }
    return out
  }

  private static func describe(_ state: ARCamera.TrackingState) -> (String, String?) {
    switch state {
    case .normal:
      return ("normal", nil)
    case .notAvailable:
      return ("notAvailable", nil)
    case .limited(let reason):
      switch reason {
      case .initializing: return ("limited", "initializing")
      case .excessiveMotion: return ("limited", "excessiveMotion")
      case .insufficientFeatures: return ("limited", "insufficientFeatures")
      case .relocalizing: return ("limited", "relocalizing")
      @unknown default: return ("limited", "unknown")
      }
    }
  }
}

import ARKit
import AVFoundation
import ExpoModulesCore

public class ApriltagArModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ApriltagAr")

    AsyncFunction("isSupportedAsync") { () -> Bool in
      ARWorldTrackingConfiguration.isSupported
    }

    AsyncFunction("requestCameraPermissionAsync") { (promise: Promise) in
      switch AVCaptureDevice.authorizationStatus(for: .video) {
      case .authorized:
        promise.resolve(true)
      case .notDetermined:
        AVCaptureDevice.requestAccess(for: .video) { granted in promise.resolve(granted) }
      default:
        promise.resolve(false)
      }
    }

    View(ApriltagArView.self) {
      Events("onFrame", "onError")

      Prop("paused") { (view: ApriltagArView, paused: Bool) in
        view.setPaused(paused)
      }
      Prop("tagSizeM") { (view: ApriltagArView, size: Double) in
        view.tagSizeM = size
      }
      Prop("maxRateHz") { (view: ApriltagArView, rate: Double) in
        view.maxRateHz = max(1, rate)
      }
    }
  }
}

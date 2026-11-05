package expo.modules.apriltagar

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.google.ar.core.ArCoreApk
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.delay

class ApriltagArModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ApriltagAr")

    AsyncFunction("isSupportedAsync") Coroutine { ->
      val context = appContext.reactContext ?: return@Coroutine false
      // The availability check can be transient right after startup; poll briefly.
      var availability = ArCoreApk.getInstance().checkAvailability(context)
      var tries = 0
      while (availability.isTransient && tries < 20) {
        delay(100)
        availability = ArCoreApk.getInstance().checkAvailability(context)
        tries++
      }
      availability.isSupported
    }

    AsyncFunction("requestCameraPermissionAsync") { promise: Promise ->
      val context = appContext.reactContext
      if (context != null &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
          PackageManager.PERMISSION_GRANTED
      ) {
        promise.resolve(true)
        return@AsyncFunction
      }
      val permissions = appContext.permissions
      if (permissions == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      permissions.askForPermissions(
        { results ->
          promise.resolve(results[Manifest.permission.CAMERA]?.status == PermissionsStatus.GRANTED)
        },
        Manifest.permission.CAMERA,
      )
    }

    OnActivityEntersForeground { ApriltagArView.active?.get()?.onHostResume() }
    OnActivityEntersBackground { ApriltagArView.active?.get()?.onHostPause() }

    View(ApriltagArView::class) {
      Events("onFrame", "onError")

      Prop("paused") { view: ApriltagArView, paused: Boolean -> view.setPaused(paused) }
      Prop("tagSizeM") { view: ApriltagArView, size: Double -> view.tagSizeM = size }
      Prop("maxRateHz") { view: ApriltagArView, rate: Double -> view.maxRateHz = maxOf(1.0, rate) }
    }
  }
}

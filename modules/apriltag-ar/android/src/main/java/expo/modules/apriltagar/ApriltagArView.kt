package expo.modules.apriltagar

import android.content.Context
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Coordinates2d
import com.google.ar.core.Frame
import com.google.ar.core.Session
import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.NotYetAvailableException
import com.google.ar.core.exceptions.UnavailableException
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.lang.ref.WeakReference
import java.nio.ByteBuffer
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

/**
 * Shows the ARCore camera feed and runs the AprilTag detector on CPU camera images at up to
 * [maxRateHz]. Each processed frame is sent to JS as `onFrame`.
 */
class ApriltagArView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext), GLSurfaceView.Renderer {

  companion object {
    /** The view currently on screen, for activity lifecycle callbacks. */
    var active: WeakReference<ApriltagArView>? = null
    private const val MAX_DETECTIONS = 32
  }

  private val onFrame by EventDispatcher()
  private val onError by EventDispatcher()

  var tagSizeM = 0.1651
  var maxRateHz = 10.0

  private val surface = GLSurfaceView(context)
  private val background = BackgroundRenderer()
  private val main = Handler(Looper.getMainLooper())
  private val worker = Executors.newSingleThreadExecutor()
  private val busy = AtomicBoolean(false)
  private val detector = AtagNative.create(2f, 2)
  private val output = DoubleArray(MAX_DETECTIONS * AtagNative.STRIDE)
  private var grayBuffer: ByteBuffer? = null

  private var session: Session? = null
  private var installRequested = false
  private var paused = false
  private var attached = false
  private var lastProcessedNs = 0L
  private var viewWidth = 1
  private var viewHeight = 1

  init {
    surface.preserveEGLContextOnPause = true
    surface.setEGLContextClientVersion(2)
    surface.setEGLConfigChooser(8, 8, 8, 8, 16, 0)
    surface.setRenderer(this)
    surface.renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
    addView(surface, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  // ---------------------------------------------------------------- lifecycle

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attached = true
    active = WeakReference(this)
    onHostResume()
  }

  override fun onDetachedFromWindow() {
    attached = false
    onHostPause()
    session?.close()
    session = null
    worker.execute { AtagNative.destroy(detector) }
    worker.shutdown()
    super.onDetachedFromWindow()
  }

  fun setPaused(value: Boolean) {
    paused = value
    if (paused) onHostPause() else onHostResume()
  }

  fun onHostResume() {
    if (!attached || paused) return
    val activity = appContext.currentActivity ?: return
    try {
      if (session == null) {
        when (ArCoreApk.getInstance().requestInstall(activity, !installRequested)) {
          ArCoreApk.InstallStatus.INSTALL_REQUESTED -> {
            installRequested = true
            return
          }
          else -> Unit
        }
        session = Session(activity).also { s ->
          val config = Config(s).apply {
            focusMode = Config.FocusMode.AUTO
            updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
          }
          s.configure(config)
        }
      }
      session?.resume()
      surface.onResume()
    } catch (e: UnavailableException) {
      emitError("ARCore is not available: ${e.message}")
    } catch (e: Exception) {
      emitError("Could not start the AR session: ${e.message}")
    }
  }

  fun onHostPause() {
    surface.onPause()
    session?.pause()
  }

  private fun emitError(message: String) = main.post { onError(mapOf("message" to message)) }

  // ---------------------------------------------------------------- GLSurfaceView.Renderer

  override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
    GLES20.glClearColor(0f, 0f, 0f, 1f)
    background.createOnGlThread()
  }

  override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
    GLES20.glViewport(0, 0, width, height)
    viewWidth = width
    viewHeight = height
    @Suppress("DEPRECATION")
    val rotation =
      (context.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.rotation
    session?.setDisplayGeometry(rotation, width, height)
  }

  override fun onDrawFrame(gl: GL10?) {
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
    val s = session ?: return
    try {
      s.setCameraTextureName(background.textureId)
      val frame = s.update()
      background.draw(frame)
      maybeDetect(frame)
    } catch (e: Exception) {
      // Session paused mid-frame or camera not ready yet; try again next frame.
    }
  }

  // ---------------------------------------------------------------- detection

  private fun maybeDetect(frame: Frame) {
    val now = frame.timestamp
    if (now - lastProcessedNs < (1e9 / maxRateHz).toLong()) return
    if (!busy.compareAndSet(false, true)) return
    lastProcessedNs = now

    val camera = frame.camera
    val (tracking, reason) = describe(camera.trackingState, camera.trackingFailureReason)
    val worldFromCamera = FloatArray(16).also { camera.pose.toMatrix(it, 0) }.let(::rowMajor)
    val intrinsics = camera.imageIntrinsics
    val focal = intrinsics.focalLength
    val principal = intrinsics.principalPoint
    val imageToView = imageToViewTransform(frame, intrinsics.imageDimensions)

    val image =
      try {
        frame.acquireCameraImage()
      } catch (e: NotYetAvailableException) {
        busy.set(false)
        return
      }
    val width: Int
    val height: Int
    try {
      width = image.width
      height = image.height
      val plane = image.planes[0]
      val buffer = grayBuffer?.takeIf { it.capacity() >= width * height }
        ?: ByteBuffer.allocateDirect(width * height).also { grayBuffer = it }
      copyLuma(plane.buffer, plane.rowStride, plane.pixelStride, width, height, buffer)
    } finally {
      image.close()
    }

    val gray = grayBuffer!!
    val tagSize = tagSizeM
    val timestamp = now / 1e9
    worker.execute {
      val n = AtagNative.detect(
        detector, gray, width, height, width,
        focal[0].toDouble(), focal[1].toDouble(), principal[0].toDouble(), principal[1].toDouble(),
        tagSize, output,
      )
      val detections = (0 until n).map { toDetection(it, imageToView) }
      main.post {
        val event = mutableMapOf<String, Any>(
          "timestamp" to timestamp,
          "tracking" to tracking,
          "worldFromCamera" to worldFromCamera,
          "detections" to detections,
        )
        reason?.let { event["trackingReason"] = it }
        onFrame(event)
        busy.set(false)
      }
    }
  }

  private fun toDetection(i: Int, imageToView: FloatArray): Map<String, Any> {
    val o = i * AtagNative.STRIDE
    val r = { k: Int -> output[o + 11 + k] }
    val t = { k: Int -> output[o + 20 + k] }
    val corners = DoubleArray(8)
    for (c in 0 until 4) {
      val x = output[o + 3 + 2 * c]
      val y = output[o + 4 + 2 * c]
      corners[2 * c] = imageToView[0] * x + imageToView[1] * y + imageToView[2]
      corners[2 * c + 1] = imageToView[3] * x + imageToView[4] * y + imageToView[5]
    }
    return mapOf(
      "id" to output[o].toInt(),
      "hamming" to output[o + 1].toInt(),
      "decisionMargin" to output[o + 2],
      "pixelSize" to output[o + 24],
      "viewAngleDeg" to output[o + 25],
      "cameraFromTag" to listOf(
        r(0), r(1), r(2), t(0),
        r(3), r(4), r(5), t(1),
        r(6), r(7), r(8), t(2),
        0.0, 0.0, 0.0, 1.0,
      ),
      "corners" to corners.toList(),
    )
  }

  /**
   * Affine map from CPU image pixels to normalized view coordinates (0..1), derived from three
   * reference points while the frame is current (the mapping is a rotation + scale + crop).
   */
  private fun imageToViewTransform(frame: Frame, dims: IntArray): FloatArray {
    val w = dims[0].toFloat()
    val h = dims[1].toFloat()
    val src = floatArrayOf(0f, 0f, w, 0f, 0f, h)
    val dst = FloatArray(6)
    frame.transformCoordinates2d(Coordinates2d.IMAGE_PIXELS, src, Coordinates2d.VIEW, dst)
    val vw = viewWidth.toFloat()
    val vh = viewHeight.toFloat()
    val (x0, y0) = dst[0] / vw to dst[1] / vh
    val (x1, y1) = dst[2] / vw to dst[3] / vh
    val (x2, y2) = dst[4] / vw to dst[5] / vh
    // view = A · [px, py] + b, with A columns from the image x and y unit steps.
    return floatArrayOf((x1 - x0) / w, (x2 - x0) / h, x0, (y1 - y0) / w, (y2 - y0) / h, y0)
  }

  private fun copyLuma(
    src: ByteBuffer, rowStride: Int, pixelStride: Int, width: Int, height: Int, dst: ByteBuffer,
  ) {
    dst.clear()
    val row = ByteArray(rowStride)
    for (y in 0 until height) {
      src.position(y * rowStride)
      val len = minOf(rowStride, src.remaining())
      src.get(row, 0, len)
      if (pixelStride == 1) {
        dst.put(row, 0, width)
      } else {
        for (x in 0 until width) dst.put(row[x * pixelStride])
      }
    }
    dst.flip()
  }

  /** ARCore matrices are column-major; JS expects row-major. */
  private fun rowMajor(m: FloatArray): List<Double> =
    (0 until 16).map { i -> m[(i % 4) * 4 + i / 4].toDouble() }

  private fun describe(state: TrackingState, reason: TrackingFailureReason): Pair<String, String?> =
    when (state) {
      TrackingState.TRACKING -> "normal" to null
      TrackingState.PAUSED -> "limited" to when (reason) {
        TrackingFailureReason.EXCESSIVE_MOTION -> "excessiveMotion"
        TrackingFailureReason.INSUFFICIENT_FEATURES -> "insufficientFeatures"
        TrackingFailureReason.INSUFFICIENT_LIGHT -> "insufficientLight"
        TrackingFailureReason.CAMERA_UNAVAILABLE -> "cameraUnavailable"
        TrackingFailureReason.BAD_STATE -> "badState"
        else -> "initializing"
      }
      TrackingState.STOPPED -> "notAvailable" to null
    }
}

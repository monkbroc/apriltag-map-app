# AprilTag Map

A React Native (Expo) app for iOS and Android that builds and refines
[Limelight AprilTag maps](https://docs.limelightvision.io/docs/docs-limelight/pipeline-apriltag/apriltag-map-specification)
(`.fmap`) by scanning a field with the phone camera, with ARKit/ARCore tracking the phone.

See [REQUIREMENTS.md](REQUIREMENTS.md) for what the app does and [PLAN.md](PLAN.md) for how it is being built.

## Development

```bash
npm install
npm start            # Metro dev server (needs a dev client build on the device)
npm run android      # build and run a dev build on a connected Android device
```

Checks (the same ones CI runs):

```bash
npm run lint
npm run typecheck
npm run format:check
npm test
```

## Building for devices

There is no app store release. Builds are installed by sideloading (Android) or through
internal distribution / TestFlight (iOS).

| Command                       | Where it runs                   | Output                                                  |
| ----------------------------- | ------------------------------- | ------------------------------------------------------- |
| `npm run build:android`       | Locally (Windows, macOS, Linux) | `android/app/build/outputs/apk/release/app-release.apk` |
| `npm run build:ios`           | Locally, **macOS + Xcode only** | `.ipa` in the project root                              |
| `npm run build:android:cloud` | EAS (cloud)                     | APK download link / QR code                             |
| `npm run build:ios:cloud`     | EAS (cloud), works from Windows | Internal-distribution install link / QR code            |

Requirements:

- **Android local build:** Android Studio (SDK, NDK, CMake), JDK 17 and `ANDROID_HOME` set.
  To sign with your own key, set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`; otherwise the debug keystore is used.
  Install with `adb install -r <apk>`.
- **iOS builds:** an Apple Developer Program membership, and each test iPhone registered with
  `npx eas-cli@latest device:create`. Install from the EAS link, or upload a production
  build to TestFlight for internal testers.

CI (`.github/workflows/eas-build.yml`) runs EAS builds on `v*` tags and on manual dispatch,
when the `EXPO_TOKEN` repository secret is set.

## License

BSD 2-Clause License. Copyright (c) 2026, Julien Vanier. See [LICENSE.md](LICENSE.md).

The vendored AprilTag library (`modules/apriltag-ar/cpp/apriltag/`, BSD 2-Clause, University of
Michigan) and the WPILib field layout data (BSD 3-Clause) keep their own licenses.

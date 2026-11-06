# AprilTag Map

A React Native (Expo) app for iOS and Android that builds and refines
[Limelight AprilTag maps](https://docs.limelightvision.io/docs/docs-limelight/pipeline-apriltag/apriltag-map-specification)
(`.fmap`) by scanning a field with the phone camera, with ARKit/ARCore tracking the phone.

See [REQUIREMENTS.md](REQUIREMENTS.md) for what the app does and [PLAN.md](PLAN.md) for how it is being built.

## Development workflow

The app has native code (the `modules/apriltag-ar` ARKit/ARCore module), so it cannot run in
Expo Go. Instead you install a **development build** on the phone once, and then load the
JavaScript from your computer. EAS is not required for Android.

### 1. Build and install the development build (once)

Android, locally (needs Android Studio's SDK, NDK and CMake, and a phone with USB debugging).
Set these two environment variables once; `npm run android` and `npm run build:android`
stop with an error if they are missing or wrong:

- `ANDROID_HOME`: the Android SDK, usually `%LOCALAPPDATA%\Android\Sdk` on Windows
- `JAVA_HOME`: a JDK 17 or 21 (React Native does not support newer JDKs), for example
  Android Studio's `jbr` folder or a Temurin 17 install

On Windows, for example (then open a new terminal):

```bash
setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"
```

```bash
setx JAVA_HOME "C:\Users\<you>\.jdks\jbr-17.0.14"
```

Windows only: the default CMake 3.22 hits the 260-character path limit while compiling native
dependencies (`ninja: error: mkdir(...): No such file or directory`). Install a newer CMake with
the SDK Manager (SDK Tools → CMake 3.31.6) and add this line to
`%USERPROFILE%\.gradle\gradle.properties` (your user Gradle config, not the repo):

```properties
android.cmakeVersion=3.31.6
```

Then:

```bash
npm install
npm run android
```

This runs `expo prebuild`, compiles the native code with Gradle, installs the debug app on the
connected phone and starts Metro. iOS needs a Mac (`npm run ios`), or a one-time cloud build
from Windows: `npx eas-cli@latest build --profile development --platform ios`.

### 2. Day-to-day: change JavaScript only

```bash
npm start
```

Open the installed app on the phone; it connects to Metro over Wi-Fi (same network) or USB
(`adb reverse tcp:8081 tcp:8081`). Saving a `.ts`/`.tsx` file reloads it on the phone in a
second. There is nothing to rebuild for screens, logic, styles or the built-in tag sets.

### 3. When you must rebuild the development build

Run step 1 again only when native things change:

- anything under `modules/apriltag-ar/` (Swift, Kotlin, C, podspec, Gradle)
- adding or upgrading a package that contains native code (`npx expo install ...`)
- `app.json` native settings (permissions, bundle ID, icons, plugins)
- an Expo SDK upgrade

Gradle is incremental, so a rebuild after a small change is much faster than the first one.

### Testing

Checks (the same ones CI runs on every push and PR):

```bash
npm run lint
npm run typecheck
npm run format:check
npm test
npm run test:native   # C detector test, needs gcc (MSYS2 on Windows)
```

The unit and screen tests run in Node with no phone: the scan flow is tested by replaying
simulated scans (`src/testing/simulate.ts`). `test:native` compiles the AprilTag C bridge on
your computer and checks detection and pose on synthetic tags rendered at known poses. The
Swift and Kotlin code has no automated tests; after changing it, run the manual checklist in [docs/device-test.md](docs/device-test.md) on a phone.

## Release workflow

There is no app store release. Builds are installed by sideloading (Android) or through
internal distribution / TestFlight (iOS).

A **release build** embeds the JavaScript bundle, so it runs without a computer. Unlike the
development build, it does not pick up JS changes on its own: after changing JS, build and
install a new release build (or use EAS Update, which is not set up in this project).

1. Make sure `main` is green in CI and run the device checklist.
2. Bump `version` in `app.json`.
3. Build:
   - Android, locally: `npm run build:android`, then `adb install -r <apk>` or share the APK.
   - iOS: `npm run build:ios:cloud` from Windows (or `npm run build:ios` on a Mac).
   - Or tag the commit (`git tag v1.2.0 && git push --tags`) and let CI run the EAS production
     build (Android only for now; run the EAS Build workflow manually with `ios` or `all` once
     iOS credentials are set up).

| Command                       | Where it runs                   | Output                                                  |
| ----------------------------- | ------------------------------- | ------------------------------------------------------- |
| `npm run build:android`       | Locally (Windows, macOS, Linux) | `android/app/build/outputs/apk/release/app-release.apk` |
| `npm run build:ios`           | Locally, **macOS + Xcode only** | `.ipa` in the project root                              |
| `npm run build:android:cloud` | EAS (cloud)                     | APK download link / QR code                             |
| `npm run build:ios:cloud`     | EAS (cloud), works from Windows | Internal-distribution install link / QR code            |

Requirements:

- **Android local build:** Android Studio (SDK, NDK, CMake), and `ANDROID_HOME` and `JAVA_HOME`
  (JDK 17 or 21) set as described under Development workflow.
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

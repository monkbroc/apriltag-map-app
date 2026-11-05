# AprilTag Map App — Requirements

A React Native (Expo) mobile app for iOS and Android that builds and refines
Limelight AprilTag maps (`.fmap`). It does this by scanning the tags on a real field
with the phone camera, while the phone's AR framework (ARKit / ARCore) tracks where
the phone is.

Reference: [Limelight .fmap specification](https://docs.limelightvision.io/docs/docs-limelight/pipeline-apriltag/apriltag-map-specification)

---

## 1. Terminology

| Term               | Meaning                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tag set**        | A named collection of fiducials, saved locally. It is exported as one `.fmap` file.                                                             |
| **Fiducial / tag** | One AprilTag entry: `id`, `size`, `transform`, `family`, `unique`.                                                                              |
| **Scan**           | A camera session that collects repeated observations of tags in the AR world frame.                                                             |
| **AR world frame** | The coordinate frame ARKit/ARCore sets up when the session starts. It is gravity-aligned (+Y up) but otherwise arbitrary relative to the field. |
| **Field frame**    | The coordinate frame of the `.fmap` file (see §3.3).                                                                                            |
| **Alignment**      | The transform (yaw rotation + translation) that maps the AR world frame onto the field frame.                                                   |
| **Observation**    | One detection of one tag in one camera frame, turned into a pose in the AR world frame.                                                         |

---

## 2. Platforms and technology

- **R-2.1** Expo (managed workflow with a dev client and `expo prebuild`), TypeScript, and the current stable Expo SDK, pinned to an exact version.
- **R-2.2** iOS 16+ on devices that support ARKit world tracking. Android 8+ on devices that support ARCore (Google Play Services for AR).
- **R-2.3** Tag detection and tracking run in a custom **Expo Module** (Swift on iOS, Kotlin on Android, with shared C code):
  - Camera frames and the 6-DoF camera pose come from **ARKit** (`ARSession` / `ARFrame`) on iOS and **ARCore** (`Session` / `Frame`) on Android.
  - Tags are detected with the official **AprilTag 3 C library** (BSD-2-Clause, `tag36h11` family), compiled into the module.
  - The tag-to-camera pose comes from the detection homography (or `estimate_tag_pose`), the frame's camera intrinsics, and the known tag size.
  - The module sends observations (tag-in-world poses and quality metrics) to JS as events. Raw frames are never passed through the JS bridge.
- **R-2.4** Accelerometer-only dead-reckoning is **not** supported. Devices without ARKit/ARCore get a clear "device not supported" message for scanning, but can still view, edit, import and export tag sets.
- **R-2.5** All geometry, merge, diff and serialization logic lives in pure TypeScript modules with no React Native dependencies, so it can be unit tested in Node.
- **R-2.6** Tuning values (acceptance thresholds, minimum observations, color thresholds, RMS warning level, default tag size) are constants in one file, `src/core/config.ts`. There is no Settings screen.

---

## 3. Data model and file format

### 3.1 `.fmap` output

- **R-3.1.1** Output is a JSON object `{ "type": "frc", "fiducials": [ ... ] }`.
- **R-3.1.2** `type` is always `"frc"` for now. Other types are out of scope.
- **R-3.1.3** Every fiducial's `family` is always `"apriltag3_36h11_classic"`. On import, the family is accepted only if it equals this value. Other families are rejected with an error that names the tag.
- **R-3.1.4** `transform` is 16 numbers in row-major order: a 3×3 rotation in indices 0–2, 4–6 and 8–10; translation in meters at indices 3, 7 and 11; and a bottom row of `0,0,0,1`.
- **R-3.1.5** `size` is in **millimeters**. Translations are in **meters**.
- **R-3.1.6** `unique` is `1` for every tag by default.
- **R-3.1.7** Fiducials are written sorted by `id`. Numbers are written with at most 6 decimal places. The JSON is pretty-printed with 2-space indentation.
- **R-3.1.8** Rotation matrices are re-orthonormalized before writing (det = +1 and RᵀR = I within 1e-9 before rounding; within 1e-5 after the 6-decimal rounding of R-3.1.7).

### 3.2 Local tag set record

Each saved tag set also stores this metadata, which is not in the `.fmap` file:

- `schemaVersion`, `id` (UUID), `name` (required, and unique among the user's sets), `createdAt`, `updatedAt`
- For each tag (optional): `observationCount` from the scan that last set its pose

### 3.3 Coordinate frame

- **R-3.3.1** The field frame matches Limelight's published FRC `.fmap` files: **origin at the center of the field**, +X along the field length, +Y along the field width, +Z up, right-handed.
- **R-3.3.2** A tag's transform maps tag-local coordinates to field coordinates, using the same tag-local axis convention as the Limelight FRC maps. The built-in set (§4) is the reference implementation of this convention. A unit test checks that a known tag in the built-in set faces the expected direction.
- **R-3.3.3** The UI shows rotation as **yaw / pitch / roll in degrees** (intrinsic Z-Y-X). It converts to and from the matrix with a round-trip error below 1e-6.

---

## 4. Built-in tag sets

- **R-4.1** The app ships with one read-only built-in set: **FRC 2026**. Its data is generated from the official FRC 2026 field layout (WPILib / Limelight published layout for the 2026 game) and is converted to the field-center `.fmap` convention if needed.
- **R-4.2** Built-in sets cannot be overwritten, renamed or deleted:
  - Refining a built-in set offers only "Save as new".
  - Starting to edit a built-in set asks for a name and creates an editable user copy first.
- **R-4.3** Built-in sets are defined in a registry (`src/data/builtinSets/`) so that later seasons can be added by dropping in a JSON file plus one registry entry.
- **R-4.4** FRC 2026 tag size defaults to **165.1 mm**.

---

## 5. Features

### 5.1 Tag set library (home screen)

- **R-5.1.1** List all tag sets: built-in sets first, then the user's sets sorted by `updatedAt`, newest first. Each row shows the name, tag count, and last-updated date.
- **R-5.1.2** Actions on each set: Open, **Refine**, Rename (user sets only), Delete (user sets only, with confirmation), and Export. These actions are available both on the library row and on the set detail screen.
- **R-5.1.3** Global actions: **New scan (fresh set)** and **Import .fmap**.

### 5.2 Starting a scan

- **R-5.2.1** **Fresh scan** starts from the global "New scan" action. It begins with no tags. Reference poses for alignment are entered by hand after scanning (R-5.4.2).
- **R-5.2.2** **Refine scan** starts from the **Refine** action on any set, built-in or user. That set becomes the reference for alignment and the baseline for comparison. No set picker is shown.
- **R-5.2.3** Before scanning, ask for camera permission and check AR support. If permission is denied, show how to enable it in the phone's settings.

### 5.3 Scanning

- **R-5.3.1** Full-screen AR camera view.
- **R-5.3.2** Live overlay: an outline and the ID over each tag detected in the current frame, plus a HUD that shows:
  - AR tracking state (normal / limited, with the reason)
  - how many tags have been seen at least the minimum number of times (`MIN_OBSERVATIONS`, 10)
  - a per-tag chip list, colored by observation count
- **R-5.3.3** Observations are only accepted when **all** of these hold (thresholds in `config.ts`):
  - the AR tracking state is _normal_
  - the AprilTag decision margin is at least a threshold
  - the tag's apparent size is at least a minimum pixel size
  - the viewing angle is at most a maximum (60° off-normal)
  - the Hamming distance is 0
- **R-5.3.4** For each tag, observations are combined into a single pose:
  - **position**: the mean of the accepted observations
  - **rotation**: the normalized quaternion mean, after flipping each quaternion into the same hemisphere as the first
  - the result also records the observation count
- **R-5.3.5** Controls: Pause/Resume and Finish.
- **R-5.3.6** Scanning only collects poses in the AR world frame. Alignment to the field happens at Finish (§5.4).

### 5.4 Alignment to the field frame

Alignment is always a **4-DoF** fit: rotation about the vertical axis (yaw) plus translation. The AR world frame's +Y (up, from gravity) is mapped to the field's +Z, so pitch and roll are never estimated.

- **R-5.4.1** **Refine mode**: compute the least-squares yaw + translation fit (closed form) between the positions of the scanned tags and the matching IDs in the reference set.
  - With 2 or more shared tags at different XY positions, fit on positions.
  - With exactly 1 shared tag, use that tag's position and yaw.
  - With no shared tags, show an error and allow the user to rescan or discard.
- **R-5.4.2** **Fresh mode**: the user picks one or more **reference tags** and gives each a field pose. The pose is typed in by hand (x/y/z in meters and yaw/pitch/roll in degrees). The default pose is the origin with identity rotation. Alignment uses the same fit as R-5.4.1.
- **R-5.4.3** Show the alignment's RMS residual and the per-tag residuals. Warn when the RMS exceeds the threshold in `config.ts` (5 cm).
- **R-5.4.4** On the residual list, the user can untick a tag to exclude it from the fit (for example, a tag that was physically moved), then refit. Excluded tags are still updated from the scan.

### 5.5 Refine comparison screen

- **R-5.5.1** After alignment in refine mode, show one row per tag ID found in either the reference set or the scan. Each row shows:
  - Tag ID and status: **Updated** (in both), **New** (only in the scan), or **Not scanned** (only in the reference)
  - **Position delta** in cm (‖Δt‖)
  - **Rotation delta** in degrees (the geodesic angle between the two rotations)
  - **% change** = ‖Δt‖ / ‖t_reference‖ × 100. If ‖t_reference‖ < 0.1 m, show "—" (undefined near the origin)
  - Observation count
- **R-5.5.2** Rows are color-coded green / yellow / red using fixed thresholds in `config.ts` (under 2 cm and 1° green; under 5 cm and 3° yellow; anything above that red). The color is always paired with an icon or text.
- **R-5.5.3** A summary header shows the number of tags updated, new, and not scanned; the median and max position delta; and the alignment RMS.
- **R-5.5.4** **Merge rule** (replace all seen):
  - every tag that was scanned and passed the minimum observation count replaces the reference pose
  - new tags are added
  - tags that were not scanned keep their reference values
  - tag `size` and `unique` are kept from the reference (new tags use the default size)
- **R-5.5.5** The screen also shows the **2D top-down map** with the old and new poses overlaid (§5.7).
- **R-5.5.6** Save actions:
  - **Save as new**: prompts for a name, defaulting to `"<reference name> (refined YYYY-MM-DD)"`.
  - **Overwrite**: replaces the reference set's tags in place, after a confirmation dialog. Disabled for built-in sets.
  - **Discard**: asks for confirmation first.
- **R-5.5.7** Fresh-mode scans skip the comparison and go straight to a review screen: the map, a tag table, and "Save as new".

### 5.6 Tag set detail and manual editing

- **R-5.6.1** The set detail screen has tabs for **Map** (2D top-down), **Table**, and **JSON**.
- **R-5.6.2** The table lists, for each tag: ID, x, y, z (m), yaw, pitch, roll (°), size (mm), and observation count if known.
- **R-5.6.3** The user can edit user sets (see R-4.2 for built-in sets):
  - **Tag size** (mm, > 0) for each tag
  - **Pose**: x/y/z and yaw/pitch/roll, with numeric validation
  - **Add tag**: by ID (a non-negative integer that is unique in the set), with a default pose at the origin
  - **Delete tag**, with confirmation
- **R-5.6.4** Edits are made on a draft, with explicit Save and Cancel. Cancel throws away the draft.
- **R-5.6.5** Changing the `type` is not exposed (it is always `frc`).

### 5.7 2D top-down map

- **R-5.7.1** A static SVG that scales to fit its container. It draws the field outline (dimensions come from the built-in set's metadata; when unknown, use a bounding box of the tags plus a margin), the field origin, and the axes.
- **R-5.7.2** Each tag is drawn as a marker at (x, y) with an arrow showing its facing direction (the tag normal projected onto XY) and its ID label. Tapping a tag opens its details.
- **R-5.7.3** Comparison mode: old poses are drawn as hollow/grey markers and new poses as filled markers, with a line between them.

### 5.8 JSON view

- **R-5.8.1** Read-only, monospaced, scrollable view of the exact `.fmap` that would be exported, with a "Copy to clipboard" button.

### 5.9 Import and export

- **R-5.9.1** **Export**: write `<name>.fmap` (the name sanitized for file systems) to the cache directory and open the OS share sheet (`expo-sharing`).
- **R-5.9.2** **Import**: pick a `.fmap` or `.json` file (`expo-document-picker`), then:
  - validate it against the schema (§3.1)
  - preview the tag count and any errors or warnings
  - ask for a set name, then save it
- **R-5.9.3** Import validation rejects:
  - invalid JSON or missing keys
  - a non-`frc` type (the error explains this)
  - a wrong family
  - duplicate IDs (when `unique` is 1)
  - a non-16-length transform
  - a bottom row that is not `0,0,0,1`
  - a non-orthonormal rotation (tolerance 1e-3)

  A rotation that is within tolerance but not exact is silently re-orthonormalized.

---

## 6. Storage

- **R-6.1** All data is local to the device. There is no account and no network.
- **R-6.2** Each user tag set is stored as one JSON file (metadata plus fiducials) in a `tagsets/` folder in the app's document directory, using `expo-file-system`. The library is built by listing that folder.
- **R-6.3** Each file carries a `schemaVersion` field (starting at 1). There is no migration code until a second version exists.
- **R-6.4** Raw observations are kept in memory only while a scan is in progress. They are not persisted after saving.

---

## 7. Non-functional requirements

- **R-7.1 Accuracy target**: on a well-lit FRC field, the tag-to-tag position error after alignment is ≤ 3 cm RMS and the rotation error is ≤ 1.5°, measured against the official layout.
- **R-7.2 Performance**: detection runs at ≥ 10 Hz on mid-range devices (iPhone 12, Pixel 6). It runs off the main thread, at a decimated resolution, with detector parameters `quad_decimate` = 2 and `nthreads` = 2–4. The UI stays at 60 fps.
- **R-7.3 Accessibility**: screen-reader labels on all controls, and the color coding is always paired with text or icons.
- **R-7.4 Quality**:
  - TypeScript `strict`, with ESLint and Prettier
  - Unit test coverage ≥ 80% for `src/core/**` (geometry, fmap, merge, diff, alignment)
  - Component tests only for the refine comparison screen and the import screen
  - No XCTest/JUnit tests. The shared C detector bridge is tested on the host with gcc (synthetic tags rendered at known poses) in CI; the platform code is checked with a manual device checklist.
- **R-7.5 Licensing**: the AprilTag library license (BSD-2) is included in an in-app "Licenses" screen.

---

## 8. Build, CI and distribution

- **R-8.1** On every PR and every push to `main`, GitHub Actions runs on Ubuntu: install with `npm ci`, then lint, typecheck, and run Jest with coverage. It fails if the coverage threshold is not met. npm dependencies are cached, and concurrency groups cancel superseded runs.
- **R-8.2** **EAS builds** run only on `v*` tags (production profile) and on manual `workflow_dispatch` (with a profile input). They need the `EXPO_TOKEN` repository secret, and the job is skipped, rather than failing, when it is not present.
- **R-8.3** **Local build commands** (npm scripts):
  - `npm run build:android` builds a release APK locally with Gradle. It works on Windows, macOS and Linux.
  - `npm run build:ios` builds an internal-distribution `.ipa` locally with `eas build --local`. It needs macOS with Xcode.
  - `npm run build:ios:cloud` runs the same iOS build on EAS, for use from Windows.
- **R-8.4** **Distribution** has no app store submission:
  - Android: sideload the APK.
  - iOS: EAS internal (ad hoc) distribution to registered devices, or TestFlight internal testing.

---

## 9. Out of scope (for now)

- App store / Play Store public release
- Pushing maps directly to a Limelight (REST upload)
- WPILib `AprilTagFieldLayout` JSON import/export
- 3D viewer
- Map types other than `frc`, and tag families other than `apriltag3_36h11_classic`
- Non-unique (repeated) tags
- Cloud sync and multi-user collaboration
- Accelerometer/IMU-only tracking
- A Settings screen

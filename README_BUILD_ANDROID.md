# Fosfle Android App (v2.0 — Course-First Edition)

A complete, redesigned native Android Studio project (`com.fosfle.learn`) converted from the Fosfle website, streamlined around the **HTML5 Mastery Course** (19 chapters, 18 timed quizzes, 18 coding challenges), **Built-in Live HTML/CSS Playground**, **Live Firebase Authentication**, and **Live Cloud Firestore Blog**.

## What Was Redesigned & Removed
- **Course-First Architecture**: 4-tab bottom navigation (`Courses`, `Practice`, `Blog`, `Account`) with a built-in live HTML/CSS Code Playground (`</> Lab`).
- **Removed Unused Pages**: Stripped generic marketing landing pages, `about`, `contact`, `services`, `projectlab`, 0-byte `css/` placeholders, `course_not_found`, help/legal boilerplate, admin editor, and broken sidebar links.
- **Bespoke Native Splash & Loading Screen**: Custom Kotlin `BlueprintSplashView` (`Canvas` hardware-accelerated drafting grid, animated `< />` code brackets, authentic Fosfle emblem, and monospace loading telemetry).
- **Live Online Connectivity**:
  - Uses `androidx.webkit.WebViewAssetLoader` (`https://appassets.androidplatform.net/`) so Firebase JS SDK ES modules work over a real HTTPS origin.
  - Real-time Android `ConnectivityManager` online/offline status sync.
  - Native Android haptic feedback, edge-to-edge dynamic status/navigation bar theming, native Share Sheet for blog posts, and smart Back-button stack handling.
  - Connected directly to your existing `fosfle` Firebase project (`Authentication` + Cloud Firestore `articles` collection) with automatic offline caching.

## How to Open & Build the APK in Android Studio
1. Extract `FosfleAndroidApp.zip`.
2. Open **Android Studio** (Ladybug / 2024.2+ recommended) and select **File → Open**, then choose the `FosfleAndroidApp` folder.
3. Let Gradle sync automatically (uses Gradle 8.9, Android Gradle Plugin 8.7.2, Kotlin 2.0.21, compileSdk 35, minSdk 24).
4. Click **Run** (`▶`) to launch on an Android device or emulator.
5. To export an installable APK: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

## Firebase Console Check (Live Auth & Blog)
- **Email/Password Auth & Password Reset**: Works out of the box with your existing `fosfle` Firebase project.
- **Authorized Domains**: In Firebase Console → **Authentication → Settings → Authorized domains**, ensure `appassets.androidplatform.net` is added if you later enable OAuth/popup providers.
- **Firestore Blog**: Published documents in the `articles` collection (`status == "published"`) load automatically in the **Blog** tab.

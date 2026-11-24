# Build Fosfle Android APK Without Android Studio (0 MB Laptop Storage)

You do **not** need to install Android Studio, Java, or any SDK on your laptop.

## Method 1: Free Cloud Build via GitHub Actions (Recommended for Native APK)
1. Go to GitHub in your browser and create a new repository (e.g. `fosfle-android`).
2. Extract this ZIP and upload the contents of `FosfleAndroidApp/` (including the `.github` folder) to the repository.
3. Open the **Actions** tab in your GitHub repository → select **Build Fosfle Android APK** → click **Run workflow** (it also starts automatically on push).
4. After ~2 minutes, open the finished run and download **Fosfle-Android-APK** under **Artifacts**.
5. Transfer the `.apk` file to your Android phone and tap it to install (enable *Install unknown apps* if prompted).

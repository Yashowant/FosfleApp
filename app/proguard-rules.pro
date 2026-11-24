# Keep Fosfle native JS bridge methods intact in release builds
-keepclassmembers class com.fosfle.learn.MainActivity$FosfleNativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

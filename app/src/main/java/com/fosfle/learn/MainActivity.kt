package com.fosfle.learn

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.webkit.*
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var lastBackPressTime = 0L
    private var safeTopPx = 0
    private var safeBottomPx = 0

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
        )
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.fosfleWebView)

        // Serve bundled assets over real HTTPS origin so Firebase Auth & Firestore ES modules work natively
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        setupInsets()
        configureWebView()
        registerConnectivityObserver()
        registerBackNavigation()

        if (savedInstanceState == null) {
            webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html?nativeSplash=1")
        }
    }

    private fun setupInsets() {
        val root = findViewById<android.view.View>(R.id.rootContainer)
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val density = resources.displayMetrics.density
            safeTopPx = (bars.top / density).toInt()
            safeBottomPx = (bars.bottom / density).toInt()
            pushSafeAreaInsets()
            insets
        }
    }

    private fun pushSafeAreaInsets() {
        val js = "document.documentElement.style.setProperty('--safe-top', '${safeTopPx}px');" +
                 "document.documentElement.style.setProperty('--safe-bottom', '${safeBottomPx}px');"
        webView.post { webView.evaluateJavascript(js, null) }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            textZoom = 100
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.addJavascriptInterface(FosfleNativeBridge(), "FosfleNative")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean = true
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()
                if (url.startsWith("https://appassets.androidplatform.net/")) {
                    return false
                }
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    openInCustomTab(url)
                    return true
                }
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                pushSafeAreaInsets()
                pushNetworkStatus(checkOnlineNow())
            }
        }
    }

    private fun openInCustomTab(url: String) {
        try {
            val customTabs = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
            customTabs.launchUrl(this, Uri.parse(url))
        } catch (_: Exception) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (_: Exception) {
                Toast.makeText(this, "Unable to open link", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun checkOnlineNow(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
        val net = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(net) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun pushNetworkStatus(online: Boolean) {
        webView.post {
            webView.evaluateJavascript(
                "window.onFosfleNetworkChange && window.onFosfleNetworkChange($online);",
                null
            )
        }
    }

    private fun registerConnectivityObserver() {
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = pushNetworkStatus(true)
            override fun onLost(network: Network) = pushNetworkStatus(checkOnlineNow())
        }
        try {
            connectivityManager?.registerNetworkCallback(request, networkCallback!!)
        } catch (_: Exception) {}
    }

    private fun registerBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    "(typeof window.fosfleHandleBack === 'function') ? window.fosfleHandleBack() : false;"
                ) { result ->
                    val handled = result?.trim() == "true"
                    if (!handled) {
                        if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            val now = System.currentTimeMillis()
                            if (now - lastBackPressTime < 2000L) {
                                finish()
                            } else {
                                lastBackPressTime = now
                                Toast.makeText(
                                    this@MainActivity,
                                    R.string.press_back_again,
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        }
                    }
                }
            }
        })
    }

    override fun onDestroy() {
        try {
            networkCallback?.let { connectivityManager?.unregisterNetworkCallback(it) }
        } catch (_: Exception) {}
        super.onDestroy()
    }

    inner class FosfleNativeBridge {
        @JavascriptInterface
        fun haptic(type: String) {
            runOnUiThread {
                val feedback = when (type) {
                    "success" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
                        HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY
                    "error" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
                        HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
                    else -> HapticFeedbackConstants.CLOCK_TICK
                }
                webView.performHapticFeedback(feedback)
            }
        }

        @JavascriptInterface
        fun shareContent(title: String, text: String, url: String) {
            runOnUiThread {
                val shareBody = if (url.isNotBlank()) "$title\n\n$text\n$url" else "$title\n\n$text"
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, title)
                    putExtra(Intent.EXTRA_TEXT, shareBody)
                }
                startActivity(Intent.createChooser(intent, "Share via"))
            }
        }

        @JavascriptInterface
        fun setSystemBarTheme(isDark: Boolean) {
            runOnUiThread {
                val style = if (isDark) {
                    SystemBarStyle.dark(Color.TRANSPARENT)
                } else {
                    SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                }
                enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
            }
        }

        @JavascriptInterface
        fun openExternalUrl(url: String) {
            runOnUiThread { openInCustomTab(url) }
        }

        @JavascriptInterface
        fun isOnline(): Boolean = checkOnlineNow()

        @JavascriptInterface
        fun getAppVersion(): String = "2.0.0"
    }
}

package com.fosfle.learn

import android.Manifest
import android.annotation.SuppressLint
import android.app.Dialog
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.view.HapticFeedbackConstants
import android.view.ViewGroup
import android.webkit.*
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var oauthDialog: Dialog? = null
    private var safeTopDp = 0
    private var safeBottomDp = 0

    private val notifPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    companion object {
        const val CHANNEL_BLOG = "fosfle_blog_updates"
        const val EXTRA_DEEP_HASH = "fosfle_deep_hash"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT)
        )
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        createNotificationChannel()
        requestNotificationPermissionIfNeeded()

        webView = findViewById(R.id.fosfleWebView)
        assetLoader = buildWwwAssetLoader()

        setupInsets()
        configureWebView()
        registerConnectivityObserver()
        registerBackNavigation()

        if (savedInstanceState == null) {
            val deepHash = intent?.getStringExtra(EXTRA_DEEP_HASH)
            val startUrl = if (!deepHash.isNullOrBlank()) {
                "https://appassets.androidplatform.net/index.html$deepHash"
            } else {
                "https://appassets.androidplatform.net/index.html"
            }
            webView.loadUrl(startUrl)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val deepHash = intent.getStringExtra(EXTRA_DEEP_HASH)
        if (!deepHash.isNullOrBlank()) {
            webView.evaluateJavascript("location.hash = ${org.json.JSONObject.quote(deepHash)};", null)
        }
    }

    private fun buildWwwAssetLoader(): WebViewAssetLoader {
        val wwwHandler = WebViewAssetLoader.PathHandler { path ->
            val clean = path.trimStart('/').ifEmpty { "index.html" }
            val assetPath = "www/$clean"
            try {
                val stream = assets.open(assetPath)
                WebResourceResponse(guessMime(clean), "UTF-8", stream)
            } catch (_: Exception) {
                null
            }
        }
        return WebViewAssetLoader.Builder()
            .addPathHandler("/", wwwHandler)
            .build()
    }

    private fun guessMime(path: String): String {
        val ext = path.substringAfterLast('.', "").lowercase(Locale.ROOT)
        return when (ext) {
            "html", "htm" -> "text/html"
            "css" -> "text/css"
            "js", "mjs" -> "application/javascript"
            "json", "webmanifest" -> "application/json"
            "svg" -> "image/svg+xml"
            "png" -> "image/png"
            "webp" -> "image/webp"
            "jpg", "jpeg" -> "image/jpeg"
            "ico" -> "image/x-icon"
            "woff2" -> "font/woff2"
            "woff" -> "font/woff"
            "ttf" -> "font/ttf"
            else -> "application/octet-stream"
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_BLOG,
                "Fosfle Blog & Course Updates",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifies you when new Fosfle articles are published"
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(ch)
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun setupInsets() {
        val root = findViewById<android.view.View>(R.id.rootContainer)
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val d = resources.displayMetrics.density
            safeTopDp = (bars.top / d).toInt()
            safeBottomDp = (bars.bottom / d).toInt()
            pushInsets()
            insets
        }
    }

    private fun pushInsets() {
        val js = "document.documentElement.style.setProperty('--sat','${safeTopDp}px');" +
                 "document.documentElement.style.setProperty('--sab','${safeBottomDp}px');"
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
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            userAgentString = userAgentString.replace("; wv", "")
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.addJavascriptInterface(FosfleNativeBridge(), "FosfleNative")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message?
            ): Boolean {
                val transport = resultMsg?.obj as? WebView.WebViewTransport ?: return false
                openOAuthPopupWebView(transport, resultMsg)
                return true
            }

            override fun onCloseWindow(window: WebView?) {
                oauthDialog?.dismiss()
                oauthDialog = null
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean = true
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                if (request.url.host == "appassets.androidplatform.net") {
                    return assetLoader.shouldInterceptRequest(request.url)
                }
                return null
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()
                if (url.startsWith("https://appassets.androidplatform.net/")) return false
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    openInCustomTab(url)
                    return true
                }
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                pushInsets()
                pushNetwork(checkOnlineNow())
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun openOAuthPopupWebView(transport: WebView.WebViewTransport, resultMsg: Message) {
        val popup = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.javaScriptCanOpenWindowsAutomatically = true
            settings.userAgentString = settings.userAgentString.replace("; wv", "")
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    if (request.url.host == "appassets.androidplatform.net") {
                        return assetLoader.shouldInterceptRequest(request.url)
                    }
                    return null
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onCloseWindow(window: WebView?) {
                    oauthDialog?.dismiss()
                    oauthDialog = null
                }
            }
        }

        val dialog = Dialog(this, android.R.style.Theme_DeviceDefault_Light_NoActionBar_Fullscreen)
        dialog.setContentView(
            popup,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        dialog.setOnDismissListener {
            popup.destroy()
            oauthDialog = null
        }
        oauthDialog = dialog
        dialog.show()

        transport.webView = popup
        resultMsg.sendToTarget()
    }

    private fun openInCustomTab(url: String) {
        try {
            CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(this, Uri.parse(url))
        } catch (_: Exception) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (_: Exception) {
                Toast.makeText(this, "Cannot open link", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun checkOnlineNow(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
        val net = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(net) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun pushNetwork(online: Boolean) {
        webView.post {
            webView.evaluateJavascript("window.onFosfleNet && window.onFosfleNet($online);", null)
        }
    }

    private fun registerConnectivityObserver() {
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val req = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = pushNetwork(true)
            override fun onLost(network: Network) = pushNetwork(checkOnlineNow())
        }
        try {
            connectivityManager?.registerNetworkCallback(req, networkCallback!!)
        } catch (_: Exception) {}
    }

    private fun registerBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (oauthDialog?.isShowing == true) {
                    oauthDialog?.dismiss()
                    return
                }
                webView.evaluateJavascript(
                    "(typeof window.fosfleBack === 'function') ? window.fosfleBack() : false;"
                ) { res ->
                    if (res?.trim() != "true") {
                        finish()
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
                val code = if (type == "success" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
                    HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.CLOCK_TICK
                webView.performHapticFeedback(code)
            }
        }

        @JavascriptInterface
        fun share(title: String, url: String) {
            runOnUiThread {
                val i = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, title)
                    putExtra(Intent.EXTRA_TEXT, "$title\n$url")
                }
                startActivity(Intent.createChooser(i, "Share"))
            }
        }

        @JavascriptInterface
        fun setStatusBar(isDark: Boolean) {
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
        fun notifyNewBlog(title: String, excerpt: String, slug: String) {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.POST_NOTIFICATIONS
                    ) != PackageManager.PERMISSION_GRANTED
                ) {
                    return@runOnUiThread
                }

                val openIntent = Intent(this@MainActivity, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    if (slug.isNotBlank()) {
                        putExtra(EXTRA_DEEP_HASH, "#/post/${Uri.encode(slug)}")
                    } else {
                        putExtra(EXTRA_DEEP_HASH, "#/blog")
                    }
                }
                val pi = PendingIntent.getActivity(
                    this@MainActivity,
                    slug.hashCode(),
                    openIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val notif = NotificationCompat.Builder(this@MainActivity, CHANNEL_BLOG)
                    .setSmallIcon(R.drawable.ic_fosfle_brand)
                    .setContentTitle("New on Fosfle Blog: $title")
                    .setContentText(excerpt.ifBlank { "Tap to read the latest article on Fosfle." })
                    .setStyle(NotificationCompat.BigTextStyle().bigText(excerpt.ifBlank { title }))
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setAutoCancel(true)
                    .setContentIntent(pi)
                    .build()

                NotificationManagerCompat.from(this@MainActivity)
                    .notify((System.currentTimeMillis() and 0x7FFFFFFF).toInt(), notif)
            }
        }

        @JavascriptInterface
        fun isOnline(): Boolean = checkOnlineNow()
    }
}

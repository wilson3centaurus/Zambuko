package com.hutano.staff;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class MainActivity extends Activity {
    private static final int WEB_PERMISSION_REQUEST = 1001;
    private static final int GEOLOCATION_PERMISSION_REQUEST = 1002;
    private static final int FILE_CHOOSER_REQUEST = 1003;

    private WebView webView;
    private ProgressBar progressBar;
    private PermissionRequest pendingWebPermission;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;
    private ValueCallback<Uri[]> fileChooserCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        createWebView();
        registerPredictiveBackHandler();

        if (savedInstanceState == null) {
            loadLaunchIntent(getIntent());
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void configureSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(getColor(R.color.role_accent));
        window.setNavigationBarColor(getColor(R.color.white));

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(
                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                );
            }
        } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
    }

    private void registerPredictiveBackHandler() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                this::handleBackNavigation
            );
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);

        root.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            dpToPx(3)
        );
        root.addView(progressBar, progressParams);
        setContentView(root);

        android.webkit.WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUserAgentString(settings.getUserAgentString() + " HutanoStaffAndroid/1.0");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new StaffWebViewClient());
        webView.setWebChromeClient(new StaffWebChromeClient());
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
            openExternal(Uri.parse(url))
        );
    }

    private void loadLaunchIntent(Intent intent) {
        Uri launchUri = intent == null ? null : intent.getData();
        webView.loadUrl(isTrustedUri(launchUri) ? launchUri.toString() : BuildConfig.APP_URL);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        loadLaunchIntent(intent);
    }

    private final class StaffWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isTrustedUri(uri)) return false;
            openExternal(uri);
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            progressBar.setVisibility(View.VISIBLE);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progressBar.setVisibility(View.GONE);
            CookieManager.getInstance().flush();
        }

        @Override
        public void onReceivedError(
            WebView view,
            WebResourceRequest request,
            WebResourceError error
        ) {
            if (request.isForMainFrame() && !"file".equals(request.getUrl().getScheme())) {
                view.loadUrl("file:///android_asset/offline.html");
            }
        }
    }

    private final class StaffWebChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progressBar.setProgress(newProgress);
            progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> handleWebPermissionRequest(request));
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(
            String origin,
            GeolocationPermissions.Callback callback
        ) {
            if (!isTrustedOrigin(origin)) {
                callback.invoke(origin, false, false);
                return;
            }
            if (hasLocationPermission()) {
                callback.invoke(origin, true, false);
                return;
            }

            pendingGeoOrigin = origin;
            pendingGeoCallback = callback;
            requestPermissions(
                new String[] {
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                },
                GEOLOCATION_PERMISSION_REQUEST
            );
        }

        @Override
        public boolean onShowFileChooser(
            WebView view,
            ValueCallback<Uri[]> filePathCallback,
            FileChooserParams fileChooserParams
        ) {
            if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = filePathCallback;

            try {
                Intent chooserIntent = fileChooserParams.createIntent();
                chooserIntent.addCategory(Intent.CATEGORY_OPENABLE);
                startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST);
            } catch (ActivityNotFoundException error) {
                fileChooserCallback = null;
                Toast.makeText(MainActivity.this, R.string.no_file_picker, Toast.LENGTH_LONG).show();
                return false;
            }
            return true;
        }
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        if (!isTrustedOrigin(request.getOrigin().toString())) {
            request.deny();
            return;
        }

        List<String> androidPermissions = new ArrayList<>();
        List<String> requestedResources = Arrays.asList(request.getResources());

        if (requestedResources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
            && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            androidPermissions.add(Manifest.permission.CAMERA);
        }
        if (requestedResources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
            && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            androidPermissions.add(Manifest.permission.RECORD_AUDIO);
        }

        if (androidPermissions.isEmpty()) {
            grantSupportedResources(request);
        } else {
            pendingWebPermission = request;
            requestPermissions(
                androidPermissions.toArray(new String[0]),
                WEB_PERMISSION_REQUEST
            );
        }
    }

    private void grantSupportedResources(PermissionRequest request) {
        List<String> granted = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)
                && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                granted.add(resource);
            } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                granted.add(resource);
            }
        }

        if (granted.isEmpty()) request.deny();
        else request.grant(granted.toArray(new String[0]));
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        String[] permissions,
        int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == WEB_PERMISSION_REQUEST && pendingWebPermission != null) {
            grantSupportedResources(pendingWebPermission);
            pendingWebPermission = null;
        } else if (requestCode == GEOLOCATION_PERMISSION_REQUEST && pendingGeoCallback != null) {
            boolean granted = hasLocationPermission();
            pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
            pendingGeoCallback = null;
            pendingGeoOrigin = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && fileChooserCallback != null) {
            Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            fileChooserCallback.onReceiveValue(result);
            fileChooserCallback = null;
        }
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isTrustedUri(Uri uri) {
        return uri != null
            && "https".equalsIgnoreCase(uri.getScheme())
            && BuildConfig.APP_HOST.equalsIgnoreCase(uri.getHost());
    }

    private boolean isTrustedOrigin(String origin) {
        try {
            return isTrustedUri(Uri.parse(origin));
        } catch (Exception error) {
            return false;
        }
    }

    private void openExternal(Uri uri) {
        String scheme = uri == null ? null : uri.getScheme();
        boolean supported = "http".equalsIgnoreCase(scheme)
            || "https".equalsIgnoreCase(scheme)
            || "tel".equalsIgnoreCase(scheme)
            || "mailto".equalsIgnoreCase(scheme)
            || "sms".equalsIgnoreCase(scheme)
            || "geo".equalsIgnoreCase(scheme);

        if (!supported) {
            Toast.makeText(this, R.string.cannot_open_link, Toast.LENGTH_LONG).show();
            return;
        }

        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, R.string.cannot_open_link, Toast.LENGTH_LONG).show();
        }
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    private void handleBackNavigation() {
        if (webView.canGoBack()) webView.goBack();
        else finish();
    }

    @Override
    @SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBackNavigation();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}

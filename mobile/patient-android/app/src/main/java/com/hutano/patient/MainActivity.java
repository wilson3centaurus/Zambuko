package com.hutano.patient;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.KeyguardManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
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
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.io.IOException;

public class MainActivity extends Activity implements SensorEventListener {
    private static final String APP_URL = "https://zambuko-patient.vercel.app/";
    private static final String APP_HOST = "zambuko-patient.vercel.app";
    private static final int WEB_PERMISSION_REQUEST = 1001;
    private static final int GEOLOCATION_PERMISSION_REQUEST = 1002;
    private static final int FILE_CHOOSER_REQUEST = 1003;

    private WebView webView;
    private ProgressBar progressBar;
    private PermissionRequest pendingWebPermission;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;
    private ValueCallback<Uri[]> fileChooserCallback;
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private int shakeCount = 0;
    private long shakeWindowStartedAt = 0L;
    private long lastShakeAt = 0L;
    private MediaPlayer rescuePlayer;
    private int previousAlarmVolume = -1;
    private Vibrator vibrator;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        createWebView();
        configureShakeDetection();
        registerPredictiveBackHandler();

        if (savedInstanceState == null) {
            Uri launchUri = getIntent().getData();
            webView.loadUrl(isTrustedUri(launchUri) ? launchUri.toString() : APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void configureSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(getColor(R.color.hutano_teal));
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
        settings.setUserAgentString(settings.getUserAgentString() + " HutanoAndroid/1.0");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new HutanoWebViewClient());
        webView.setWebChromeClient(new HutanoWebChromeClient());
        webView.addJavascriptInterface(new HutanoNativeBridge(), "HutanoNative");
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
            openExternal(Uri.parse(url))
        );
    }

    private final class HutanoNativeBridge {
        @JavascriptInterface
        public void requestQuickSOS() {
            runOnUiThread(() -> authenticateForQuickSOS("biometric"));
        }

        @JavascriptInterface
        public void activateRescueSignal() {
            runOnUiThread(MainActivity.this::startRescueSignal);
        }
    }

    private void configureShakeDetection() {
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        }
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (sensorManager != null && accelerometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI);
        }
    }

    @Override
    protected void onPause() {
        if (sensorManager != null) sensorManager.unregisterListener(this);
        super.onPause();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_ACCELEROMETER) return;
        double force = Math.sqrt(
            event.values[0] * event.values[0]
                + event.values[1] * event.values[1]
                + event.values[2] * event.values[2]
        ) / SensorManager.GRAVITY_EARTH;
        long now = SystemClock.elapsedRealtime();
        if (force < 2.7 || now - lastShakeAt < 350) return;
        lastShakeAt = now;
        if (shakeWindowStartedAt == 0L || now - shakeWindowStartedAt > 4000) {
            shakeWindowStartedAt = now;
            shakeCount = 1;
        } else {
            shakeCount += 1;
        }
        if (shakeCount >= 3) {
            shakeCount = 0;
            shakeWindowStartedAt = 0L;
            runOnUiThread(this::confirmShakeSOS);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // No accuracy-specific handling is needed for the emergency gesture.
    }

    private void confirmShakeSOS() {
        if (isFinishing()) return;
        new AlertDialog.Builder(this)
            .setTitle("Open Quick SOS?")
            .setMessage("Three shakes were detected. Continue to confirm your emergency, symptoms, and location. This does not send an SOS yet.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Continue", (dialog, which) -> authenticateForQuickSOS("shake"))
            .show();
    }

    private void authenticateForQuickSOS(String source) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            BiometricManager manager = (BiometricManager) getSystemService(Context.BIOMETRIC_SERVICE);
            if (manager != null && manager.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS) {
                CancellationSignal cancellation = new CancellationSignal();
                BiometricPrompt prompt = new BiometricPrompt.Builder(this)
                    .setTitle("Verify Quick SOS")
                    .setSubtitle("Use your phone biometric to open the fast emergency form")
                    .setNegativeButton("Cancel", getMainExecutor(), (dialog, which) -> cancellation.cancel())
                    .build();
                prompt.authenticate(cancellation, getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        openQuickSOS(source);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        if (errorCode != BiometricPrompt.BIOMETRIC_ERROR_CANCELED
                            && errorCode != BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED) {
                            Toast.makeText(MainActivity.this, "Biometric verification was not completed.", Toast.LENGTH_LONG).show();
                        }
                    }
                });
                return;
            }
        }

        KeyguardManager keyguard = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (keyguard != null && keyguard.isDeviceSecure()) {
            new AlertDialog.Builder(this)
                .setTitle("Biometric unavailable")
                .setMessage("This phone has no supported biometric enrolled. Continue with the normal confirmed SOS form?")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Continue", (dialog, which) -> openQuickSOS(source))
                .show();
        } else {
            openQuickSOS(source);
        }
    }

    private void openQuickSOS(String source) {
        runOnUiThread(() -> webView.loadUrl(APP_URL + "emergency?quick=1&source=" + source));
    }

    private void startRescueSignal() {
        stopRescueSignal();
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            previousAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
            audioManager.setStreamVolume(
                AudioManager.STREAM_ALARM,
                audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM),
                0
            );
        }
        Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        rescuePlayer = new MediaPlayer();
        try {
            rescuePlayer.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            rescuePlayer.setDataSource(this, alarmUri);
            rescuePlayer.setLooping(true);
            rescuePlayer.prepare();
            rescuePlayer.start();
        } catch (IOException | RuntimeException error) {
            rescuePlayer.release();
            rescuePlayer = null;
            Toast.makeText(this, "The rescue alarm could not start. Vibration will continue.", Toast.LENGTH_LONG).show();
        }
        if (vibrator != null && vibrator.hasVibrator()) {
            long[] pattern = {0, 1000, 400, 1000, 400};
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                vibrator.vibrate(pattern, 0);
            }
        }
        new Handler(Looper.getMainLooper()).postDelayed(this::stopRescueSignal, 60000);
        new AlertDialog.Builder(this)
            .setTitle("Rescue signal active")
            .setMessage("The alarm and vibration will stop automatically after one minute.")
            .setCancelable(false)
            .setPositiveButton("Stop now", (dialog, which) -> stopRescueSignal())
            .show();
    }

    private void stopRescueSignal() {
        if (rescuePlayer != null) {
            if (rescuePlayer.isPlaying()) rescuePlayer.stop();
            rescuePlayer.release();
            rescuePlayer = null;
        }
        if (vibrator != null) vibrator.cancel();
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null && previousAlarmVolume >= 0) {
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, previousAlarmVolume, 0);
            previousAlarmVolume = -1;
        }
    }

    private final class HutanoWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isTrustedUri(uri)) {
                return false;
            }

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

    private final class HutanoWebChromeClient extends WebChromeClient {
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
            WebView webView,
            ValueCallback<Uri[]> filePathCallback,
            FileChooserParams fileChooserParams
        ) {
            if (fileChooserCallback != null) {
                fileChooserCallback.onReceiveValue(null);
            }
            fileChooserCallback = filePathCallback;

            Intent chooserIntent;
            try {
                chooserIntent = fileChooserParams.createIntent();
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

        if (granted.isEmpty()) {
            request.deny();
        } else {
            request.grant(granted.toArray(new String[0]));
        }
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
            && APP_HOST.equalsIgnoreCase(uri.getHost());
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
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
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
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            finish();
        }
    }

    @Override
    @SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBackNavigation();
    }

    @Override
    protected void onDestroy() {
        stopRescueSignal();
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}

# Hutano Patient Android

Native Android wrapper for the production Hutano Patient web application.

## Build

From this directory:

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat assembleRelease
```

The installable APK is generated at:

```text
app/build/outputs/apk/release/app-release.apk
```

The current release build uses Android's local debug signing key so it can be
installed directly for testing and client demonstrations. A Play Store release
must use a durable private production signing key.

# Hutano Staff Android APKs

One secure WebView shell produces three independently installable Android apps:

| Flavor | Package | Production portal |
| --- | --- | --- |
| Doctor | `com.hutano.doctor` | `https://zambuko-doctor.vercel.app/` |
| Dispatch | `com.hutano.dispatch` | `https://zambuko-dispatch.vercel.app/` |
| Admin | `com.hutano.admin` | `https://zambuko-admin.vercel.app/` |

Build all release APKs:

```powershell
.\gradlew.bat assembleRelease lintRelease
```

The current release variants use Android's debug signing key so they are
installable for pilots. Configure a durable private release key before Play
Store or managed-enterprise distribution.

# Driver App (Android APK) Setup

This project now includes a separate Android wrapper app in `driver-mobile/` for the driver experience.

## What this does

- Opens only the driver experience from your deployed web app using this URL format:
  - `https://YOUR_DEPLOYED_APP_DOMAIN/driver`
- Lets you build and install an APK on an Android phone.

## 1) Prerequisites (Windows)

Install these first:

1. Node.js (already installed)
2. Java JDK 17+
3. Android Studio (includes Android SDK + build tools)
4. Android SDK Platform 34 (or latest)
5. Android command-line tools and platform-tools

## 2) Set your driver app URL

The mobile wrapper loads the URL from `DRIVER_APP_URL`.

PowerShell example:

```powershell
$env:DRIVER_APP_URL="https://your-live-domain.com/driver"
```

You can also hardcode the URL in `driver-mobile/capacitor.config.ts`.

## 3) Install and generate Android project

From the workspace root:

```powershell
npm run driver:mobile:add-android
```

This installs dependencies and creates `driver-mobile/android/`.

## 4) Sync config changes

```powershell
npm run driver:mobile:sync
```

Run this whenever you update `capacitor.config.ts`.

## 5) Open Android Studio project

```powershell
npm run driver:mobile:open
```

In Android Studio:

1. Wait for Gradle sync.
2. Set build variant to `debug`.
3. Build APK:
   - Build -> Build Bundle(s) / APK(s) -> Build APK(s)

APK output is usually at:

- `driver-mobile/android/app/build/outputs/apk/debug/app-debug.apk`

## 6) Install on phone

1. Enable Developer Options + USB debugging on the phone.
2. Connect via USB.
3. Install from Android Studio or with `adb install`.

## Notes

- If your site uses HTTP (not HTTPS), keep `cleartext` enabled (already handled automatically).
- Push notifications from web APIs may need native plugin setup later.
- This wrapper keeps the driver app separate from admin usage at install level (different app package).

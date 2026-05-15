import type { ExpoConfig, ConfigContext } from "expo/config"

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Sterlin Driver",
  slug: "sterlin-driver",
  version: "1.0.0",
  scheme: "sterlindriver",
  orientation: "portrait",
  icon: "./assets/icon1.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  updates: {
    url: "https://u.expo.dev/3ea6003a-6987-4053-a2d6-9f94e0e98dd5",
    enabled: true,
    fallbackToCacheTimeout: 0,
    checkAutomatically: "ON_LOAD",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.sterlinglams.driver",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Location is used to update your position for delivery tracking.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Background location is used to keep tracking active while delivering.",
      NSCameraUsageDescription:
        "Camera is used to capture proof-of-delivery photos.",
      NSPhotoLibraryUsageDescription:
        "Photo library access lets you attach delivery photos.",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#16a34a",
    },
    package: "com.sterlinglams.driver",
    config: {
      googleMaps: {
        // Set GOOGLE_MAPS_API_KEY in your EAS secret or local .env
        apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
      },
    },
    permissions: [
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.CAMERA",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.VIBRATE",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_LOCATION",
      "android.permission.RECORD_AUDIO",
    ],
  },
  plugins: [
    "expo-router",
    "expo-screen-orientation",
    "expo-secure-store",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Allow Sterlin Driver to use your location for delivery tracking.",
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/icon1.png",
        color: "#16a34a",
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "Allow Sterlin Driver to access your camera for proof-of-delivery photos.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Allow Sterlin Driver to access your photos.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: { origin: false },
    eas: { projectId: "d227ba9d-29e4-469a-b341-acdf23ba074c" },
  },
})

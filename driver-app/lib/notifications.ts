import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import Constants from "expo-constants"
import { driverFetch } from "./api"
import { savePushToken } from "./storage"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function registerForPushNotifications(driverId: string): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== "granted") return null

  if (Platform.OS === "android") {
    await Promise.all([
      Notifications.setNotificationChannelAsync("default", {
        name: "General",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#16a34a",
      }),
      Notifications.setNotificationChannelAsync("new_order", {
        name: "New Orders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: "#f97316",
        sound: "default",
      }),
      Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0ea5e9",
      }),
    ])
  }

  try {
    const projectId = (Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId) as string | undefined
    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    const token = tokenData.data

    await savePushToken(token)
    await driverFetch("/api/driver/push-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, token, platform: Platform.OS }),
    }).catch(() => {})

    return token
  } catch {
    return null
  }
}

export function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId = "default"
) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true, ...(Platform.OS === "android" ? { channelId } : {}) },
    trigger: null,
  }).catch(() => {})
}

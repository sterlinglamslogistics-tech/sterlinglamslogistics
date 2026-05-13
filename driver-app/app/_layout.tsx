import { useEffect } from "react"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import * as Notifications from "expo-notifications"
import { router } from "expo-router"
import { DriverProvider } from "@/context/DriverContext"

function NotificationResponseHandler() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined
      const type = data?.type as string | undefined

      if (type === "new_order" && data?.orderId) {
        router.push(`/order/${data.orderId}` as never)
      } else if (type === "new_message" && data?.threadId) {
        const name = encodeURIComponent((data.threadName as string) ?? "Chat")
        const orderId = (data.orderId as string) ?? ""
        const orderNumber = (data.orderNumber as string) ?? ""
        router.push(`/messages/${data.threadId}?name=${name}&orderId=${orderId}&orderNumber=${orderNumber}` as never)
      } else if (type === "new_message") {
        router.push("/(tabs)/messages" as never)
      }
    })
    return () => sub.remove()
  }, [])
  return null
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DriverProvider>
          <StatusBar style="dark" />
          <NotificationResponseHandler />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="order/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="delivery/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="completed-orders" options={{ presentation: "card" }} />
            <Stack.Screen name="settings" options={{ presentation: "card" }} />
            <Stack.Screen name="messages/[id]" options={{ presentation: "card" }} />
          </Stack>
        </DriverProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

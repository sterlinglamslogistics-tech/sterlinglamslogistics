import { Tabs, Redirect } from "expo-router"
import { View, Text, ActivityIndicator, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { MaterialIcons } from "@expo/vector-icons"
import { useDriver } from "@/context/DriverContext"
import { DrawerMenu } from "@/components/DrawerMenu"

export default function TabsLayout() {
  const { session, loadingSession, unreadMessageCount, orders } = useDriver()
  const waitingCount = orders.filter((o) => o.status === "unassigned").length
  const insets = useSafeAreaInsets()

  if (loadingSession) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    )
  }

  if (!session) return <Redirect href="/" />

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#16a34a",
          tabBarInactiveTintColor: "#9ca3af",
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopColor: "#e5e7eb",
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 4,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Orders",
            tabBarIcon: ({ color, size }) => <MaterialIcons name="shopping-bag" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: "Map",
            tabBarIcon: ({ color, size }) => <MaterialIcons name="location-on" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="waiting"
          options={{
            title: "Waiting",
            tabBarIcon: ({ color, size }) => (
              <View>
                <MaterialIcons name="format-list-bulleted" size={size} color={color} />
                {waitingCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {waitingCount > 9 ? "9+" : String(waitingCount)}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",
            tabBarIcon: ({ color, size }) => (
              <View>
                <MaterialIcons name="chat-bubble-outline" size={size} color={color} />
                {unreadMessageCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadMessageCount > 9 ? "9+" : String(unreadMessageCount)}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="performance"
          options={{
            title: "Performance",
            tabBarIcon: ({ color, size }) => <MaterialIcons name="bar-chart" size={size} color={color} />,
          }}
        />
        {/* Hidden tabs — accessible from drawer */}
        <Tabs.Screen name="completed" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>

      {/* Global left drawer — rendered above tabs */}
      <DrawerMenu />
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 11,
  },
})

import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"
import type { DriverSession, PendingDelivery } from "./types"

const KEYS = {
  // Stored in SecureStore (encrypted, hardware-backed where available)
  SESSION: "driverSession",
  TOKEN: "driverToken",
  // Stored in AsyncStorage (non-sensitive)
  PENDING: "pendingDeliveries",
  NAV_APP: "navApp",
  PREFS: "driverPreferences",
  PROFILE_PHOTO: "driverProfilePhoto",
  THEME: "displayTheme",
  PUSH_TOKEN: "expoPushToken",
  ONLINE_STATUS: "driverOnlineStatus",
}

// ── Session ──────────────────────────────────────────────────────────────────
// SecureStore is preferred (hardware-backed encryption) but can fail on some
// devices/OS combinations. AsyncStorage is used as a fallback.
const FALLBACK_KEYS = {
  SESSION: "fb_driverSession",
  TOKEN: "fb_driverToken",
}

export async function saveSession(session: DriverSession): Promise<void> {
  const sessionStr = JSON.stringify(session)
  try {
    await SecureStore.setItemAsync(KEYS.SESSION, sessionStr)
    await SecureStore.setItemAsync(KEYS.TOKEN, session.token)
    // Clear any old fallback data
    await AsyncStorage.multiRemove([FALLBACK_KEYS.SESSION, FALLBACK_KEYS.TOKEN]).catch(() => {})
  } catch {
    // SecureStore unavailable — fall back to AsyncStorage
    await AsyncStorage.setItem(FALLBACK_KEYS.SESSION, sessionStr)
    await AsyncStorage.setItem(FALLBACK_KEYS.TOKEN, session.token)
  }
}

export async function loadSession(): Promise<DriverSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEYS.SESSION)
    if (raw) return JSON.parse(raw) as DriverSession
  } catch { /* fall through to AsyncStorage */ }
  try {
    const raw = await AsyncStorage.getItem(FALLBACK_KEYS.SESSION)
    if (raw) return JSON.parse(raw) as DriverSession
  } catch { /* ignore */ }
  return null
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.SESSION).catch(() => {})
  await SecureStore.deleteItemAsync(KEYS.TOKEN).catch(() => {})
  await AsyncStorage.multiRemove([FALLBACK_KEYS.SESSION, FALLBACK_KEYS.TOKEN]).catch(() => {})
}

export async function getToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(KEYS.TOKEN)
    if (token) return token
  } catch { /* fall through */ }
  return AsyncStorage.getItem(FALLBACK_KEYS.TOKEN)
}

// ── Pending offline deliveries ────────────────────────────────────────────────

export async function getPendingDeliveries(): Promise<PendingDelivery[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PENDING)
    return raw ? (JSON.parse(raw) as PendingDelivery[]) : []
  } catch {
    return []
  }
}

export async function queueDelivery(item: PendingDelivery): Promise<void> {
  const existing = await getPendingDeliveries()
  const updated = [...existing.filter((p) => p.orderId !== item.orderId), item]
  await AsyncStorage.setItem(KEYS.PENDING, JSON.stringify(updated))
}

export async function removePendingDelivery(orderId: string): Promise<void> {
  const existing = await getPendingDeliveries()
  await AsyncStorage.setItem(
    KEYS.PENDING,
    JSON.stringify(existing.filter((p) => p.orderId !== orderId))
  )
}

// ── Push token ────────────────────────────────────────────────────────────────

export async function savePushToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.PUSH_TOKEN, token)
}

export async function getPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.PUSH_TOKEN)
}

// ── Navigation app preference ─────────────────────────────────────────────────

export async function getNavApp(): Promise<"google" | "waze" | "yandex"> {
  const val = await AsyncStorage.getItem(KEYS.NAV_APP)
  return (val as "google" | "waze" | "yandex") ?? "google"
}

export async function saveNavApp(app: "google" | "waze" | "yandex"): Promise<void> {
  await AsyncStorage.setItem(KEYS.NAV_APP, app)
}

// ── Preferences ───────────────────────────────────────────────────────────────

export interface Preferences {
  newOrderAlert: boolean
  statusConfirmation: boolean
  podRequired: boolean
  cashTips: boolean
}

const DEFAULT_PREFS: Preferences = {
  newOrderAlert: true,
  statusConfirmation: false,
  podRequired: true,
  cashTips: false,
}

export async function getPreferences(): Promise<Preferences> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PREFS)
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFS
  }
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  await AsyncStorage.setItem(KEYS.PREFS, JSON.stringify(prefs))
}

// ── Profile photo ─────────────────────────────────────────────────────────────

export async function getProfilePhoto(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.PROFILE_PHOTO)
}

export async function saveProfilePhoto(uri: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.PROFILE_PHOTO, uri)
}

// ── Display theme ─────────────────────────────────────────────────────────────

export async function getTheme(): Promise<"light" | "dark" | "system"> {
  const val = await AsyncStorage.getItem(KEYS.THEME)
  return (val as "light" | "dark" | "system") ?? "system"
}

export async function saveTheme(theme: "light" | "dark" | "system"): Promise<void> {
  await AsyncStorage.setItem(KEYS.THEME, theme)
}

// ── Navigation URL builder ────────────────────────────────────────────────────

export function buildNavUrl(address: string, app: "google" | "waze" | "yandex"): string {
  const encoded = encodeURIComponent(address)
  switch (app) {
    case "waze":
      return `waze://?q=${encoded}&navigate=yes`
    case "yandex":
      return `yandexnavi://build_route_on_map?addr_to=${encoded}`
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`
  }
}

export const HUB_NAME = "Sterlin Glams"
export const HUB_ADDRESS = "Sterlin Glams – Ikota Ajah Lagos"
export const HUB_PHONE = "+2349160009893"

// ── Online status (persisted so app restart keeps driver online) ───────────────

export async function saveOnlineStatus(online: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.ONLINE_STATUS, online ? "1" : "0").catch(() => {})
}

export async function getOnlineStatus(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.ONLINE_STATUS).catch(() => null)
  return val === "1"
}

import { getToken, clearSession } from "./storage"
import { router } from "expo-router"

const BASE = "https://sterlinglamslogistics.com"
const TIMEOUT_MS = 12_000

let _redirecting = false
// In-memory token cache — avoids SecureStore read on every request
let _tokenCache: string | null = null

export function clearTokenCache() {
  _tokenCache = null
}

export async function driverFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // Read from cache; only hit SecureStore when cache is empty
  if (_tokenCache === null) {
    _tokenCache = await getToken()
  }
  const token = _tokenCache
  const headers = new Headers(init.headers ?? {})
  if (token) headers.set("X-Driver-Token", token)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }

  if (response.status === 401 && !_redirecting) {
    _redirecting = true
    _tokenCache = null // invalidate cache on auth failure
    await clearSession()
    router.replace("/")
    setTimeout(() => { _redirecting = false }, 3000)
  }

  return response
}

export async function fetchDriverOrders(driverId: string): Promise<import("./types").Order[]> {
  const res = await driverFetch(`/api/driver/orders?driverId=${encodeURIComponent(driverId)}`)
  if (!res.ok) return []
  const data = await res.json() as { orders?: import("./types").Order[] }
  return data.orders ?? []
}

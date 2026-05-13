import { getToken, clearSession } from "./storage"
import { router } from "expo-router"

const BASE = "https://sterlinglamslogistics.com"

let _redirecting = false

export async function driverFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken()
  const headers = new Headers(init.headers ?? {})
  if (token) headers.set("X-Driver-Token", token)

  const response = await fetch(`${BASE}${path}`, { ...init, headers })

  if (response.status === 401 && !_redirecting) {
    _redirecting = true
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

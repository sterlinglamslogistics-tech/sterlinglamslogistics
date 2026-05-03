"use client"

const TOKEN_KEY = "driverToken"

export function setDriverToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // ignore storage errors (private mode etc.)
  }
}

export function getDriverToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function clearDriverToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

/**
 * fetch wrapper that attaches the driver session token as `X-Driver-Token`
 * (cookies cover web; the header covers Capacitor WebView clients where
 * cookies may not roundtrip reliably).
 */
export async function driverFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getDriverToken()
  const headers = new Headers(init.headers ?? {})
  if (token && !headers.has("X-Driver-Token")) {
    headers.set("X-Driver-Token", token)
  }
  return fetch(input, { ...init, headers, credentials: "include" })
}

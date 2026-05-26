/**
 * Safe wrappers around Capacitor plugins (Haptics, StatusBar, App).
 *
 * Everything here is a no-op when running in a plain browser (driver
 * accessing /driver from Chrome). When running inside the driver-mobile
 * Capacitor APK the calls reach the real native modules — so the same
 * code gives haptic feedback / styled status bar / Android back-button
 * handling on device, and does nothing harmful on the web.
 *
 * Plugin imports are dynamic + try/catch so we never crash if a plugin
 * isn't installed; this also keeps the web bundle slim because the
 * Capacitor packages aren't required at build time.
 */

type ImpactStyle = "light" | "medium" | "heavy"

/** Brief tactile bump on button presses. */
export async function hapticTap(style: ImpactStyle = "light"): Promise<void> {
  if (typeof window === "undefined") return
  try {
    const mod = await import("@capacitor/haptics")
    const map = { light: mod.ImpactStyle.Light, medium: mod.ImpactStyle.Medium, heavy: mod.ImpactStyle.Heavy }
    await mod.Haptics.impact({ style: map[style] })
  } catch {
    /* Capacitor not present (regular browser) — silently do nothing */
  }
}

/** Distinct success notification pattern — use on "delivered" etc. */
export async function hapticSuccess(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    const mod = await import("@capacitor/haptics")
    await mod.Haptics.notification({ type: mod.NotificationType.Success })
  } catch { /* ignore */ }
}

/** Distinct error notification pattern — use on failed actions. */
export async function hapticError(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    const mod = await import("@capacitor/haptics")
    await mod.Haptics.notification({ type: mod.NotificationType.Error })
  } catch { /* ignore */ }
}

/**
 * Set the Android status bar colour + foreground style. Call once on
 * driver-shell mount so the bar matches the app theme.
 */
export async function applyStatusBar(opts: { backgroundColor: string; dark?: boolean }): Promise<void> {
  if (typeof window === "undefined") return
  try {
    const mod = await import("@capacitor/status-bar")
    await mod.StatusBar.setBackgroundColor({ color: opts.backgroundColor })
    await mod.StatusBar.setStyle({ style: opts.dark ? mod.Style.Dark : mod.Style.Light })
    await mod.StatusBar.setOverlaysWebView({ overlay: false })
  } catch { /* ignore */ }
}

/**
 * Wire the Android hardware back button. Returns an unsubscribe fn.
 * When the user presses back, your handler runs. Return true to
 * indicate you handled it (Capacitor won't pop the stack); return
 * false to let the default behaviour (back-nav or app-exit) run.
 */
export async function onAndroidBack(handler: () => boolean | Promise<boolean>): Promise<() => void> {
  if (typeof window === "undefined") return () => {}
  try {
    const mod = await import("@capacitor/app")
    const listener = await mod.App.addListener("backButton", async () => {
      const handled = await handler()
      if (!handled) {
        // Caller chose not to handle this back press — fall back to history
        if (window.history.length > 1) window.history.back()
        else await mod.App.exitApp()
      }
    })
    return () => { void listener.remove() }
  } catch {
    return () => {}
  }
}

/** True when running inside a Capacitor WebView (driver-mobile APK). */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false
  try {
    // @ts-expect-error Capacitor injects this global at runtime
    return Boolean(window.Capacitor?.isNativePlatform?.())
  } catch {
    return false
  }
}

import { formatCurrency } from "@/lib/data"

function esc(text: string): string {
  const el = document.createElement("span")
  el.textContent = text
  return el.innerHTML
}

export function parseFirestoreDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "object" && value !== null) {
    const maybeObj = value as { toDate?: () => Date; seconds?: number }
    if (typeof maybeObj.toDate === "function") return maybeObj.toDate()
    if (typeof maybeObj.seconds === "number") return new Date(maybeObj.seconds * 1000)
  }
  return null
}

export function formatOrderTime(value: unknown) {
  const date = parseFirestoreDate(value)
  if (!date) return "--"
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function formatDistance(distanceKm: unknown) {
  if (typeof distanceKm !== "number" || Number.isNaN(distanceKm)) return "--"
  return `${distanceKm.toFixed(2)} km`
}

export function formatTimeAmPm(time: string | undefined | null): string {
  if (!time) return "N/A"
  const parts = time.split(":")
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m)) return time
  const period = h >= 12 ? "p.m." : "a.m."
  const hour12 = h % 12 || 12
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`
}

export function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}

export function handlePrintOrder(order: { orderNumber: string; customerName: string; phone: string; address: string; amount: number; status: string; assignedDriver: string | null; deliveryInstruction?: string; items?: Array<{ name: string; price?: number; qty?: number }> }, getDriverDisplayName: (id: string | null) => string) {
  const w = window.open("", "_blank")
  if (!w) return
  const items = (order.items ?? []).map((i) => `<tr><td>${esc(i.name)}</td><td>${i.qty ?? 1}</td><td>${formatCurrency(i.price ?? 0)}</td></tr>`).join("")
  w.document.write(`<html><head><title>Order ${esc(order.orderNumber)}</title><style>body{font-family:system-ui,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body>
    <h1>Order #${esc(order.orderNumber)}</h1>
    <p><b>Customer:</b> ${esc(order.customerName)}</p>
    <p><b>Phone:</b> ${esc(order.phone)}</p>
    <p><b>Address:</b> ${esc(order.address)}</p>
    <p><b>Amount:</b> ${formatCurrency(order.amount)}</p>
    <p><b>Status:</b> ${esc(order.status)}</p>
    <p><b>Driver:</b> ${order.assignedDriver ? esc(getDriverDisplayName(order.assignedDriver)) : "Unassigned"}</p>
    ${order.deliveryInstruction ? `<p><b>Instructions:</b> ${esc(order.deliveryInstruction)}</p>` : ""}
    <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${items}</tbody></table>
  </body></html>`)
  w.document.close()
  w.print()
}

export function handlePrintLabel(order: { orderNumber: string; customerName: string; phone: string; address: string }) {
  const w = window.open("", "_blank")
  if (!w) return
  w.document.write(`<html><head><title>Label ${esc(order.orderNumber)}</title><style>body{font-family:monospace;padding:16px;font-size:14px}h2{margin:0 0 8px}p{margin:4px 0}.barcode{font-family:'Libre Barcode 128',monospace;font-size:48px;margin-top:12px}</style><link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet"></head><body>
    <h2>#${esc(order.orderNumber)}</h2>
    <p><b>${esc(order.customerName)}</b></p>
    <p>${esc(order.phone)}</p>
    <p>${esc(order.address)}</p>
    <div class="barcode">${esc(order.orderNumber)}</div>
  </body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 500)
}

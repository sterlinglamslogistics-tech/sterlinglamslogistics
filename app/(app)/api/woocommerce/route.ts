import { NextResponse } from "next/server"
import { adminCreateOrderWithId, adminOrderExists } from "@/lib/server/firestore-admin"
import { adminDb } from "@/lib/server/firebase-admin"
import { createHmac, timingSafeEqual } from "crypto"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { createLogger } from "@/lib/logger"
import { audit } from "@/lib/audit"

const log = createLogger("api:woocommerce")
const WEBHOOK_SECRET = process.env.WOOCOMMERCE_WEBHOOK_SECRET ?? ""

/**
 * Verify WooCommerce webhook signature (HMAC-SHA256, base64-encoded).
 * The signature arrives in the `x-wc-webhook-signature` header.
 */
function verifySignature(body: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature) return false
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(body, "utf8")
    .digest("base64")
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

/**
 * Check if an order with this WooCommerce order number already exists.
 * Checks both stripped ("12345") and prefixed ("WC-12345") variants to
 * prevent duplicates from orders imported before the prefix was stripped.
 */
async function orderExists(orderNumber: string): Promise<boolean> {
  return adminOrderExists(orderNumber)
}

/**
 * Map a WooCommerce order payload to our Order shape.
 */
function mapWooOrder(wc: WooOrder) {
  const shipping = wc.shipping ?? wc.billing ?? {}
  const addressParts = [
    shipping.address_1,
    shipping.address_2,
    shipping.city,
    shipping.state,
    shipping.postcode,
    shipping.country,
  ].filter(Boolean)

  const customerName = [
    shipping.first_name ?? wc.billing?.first_name,
    shipping.last_name ?? wc.billing?.last_name,
  ]
    .filter(Boolean)
    .join(" ") || "WooCommerce Customer"

  const items = (wc.line_items ?? []).map((li) => {
    const metaParts = (li.meta_data ?? [])
      .filter((m) => m.key && !m.key.startsWith("_"))
      .map((m) => `+${m.key} : ${m.value ?? ""}`)
    return {
      name: li.name ?? "Item",
      qty: li.quantity ?? 1,
      price: Number(li.total) || 0,
      ...(metaParts.length ? { meta: metaParts.join("\n") } : {}),
    }
  })

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const total = Number(wc.total) || subtotal
  const shippingTotal = Number(wc.shipping_total) || 0
  const discountTotal = Number(wc.discount_total) || 0

  const now = new Date()

  return {
    orderNumber: `${wc.number ?? wc.id}`.replace(/^WC-/i, ""),
    // Pick-up defaults
    pickupName: "Sterlin Glams",
    pickupPhone: "+234 9160009893",
    pickupAddress: "Sterlin Glams – Ikota Ajah Lagos",
    pickupTime: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    // Deliver to
    customerName,
    phone: shipping.phone || wc.billing?.phone || "",
    customerEmail: wc.billing?.email || null,
    address: addressParts.join(", ") || "No address provided",
    deliveryDate: now.toISOString().split("T")[0],
    deliveryTime: "",
    // Order details
    items,
    subtotal,
    taxRate: 0,
    tax: Number(wc.total_tax) || 0,
    deliveryFees: shippingTotal,
    deliveryTips: 0,
    discount: discountTotal,
    amount: total,
    deliveryInstruction: wc.customer_note ?? "",
    paymentMethod: wc.payment_method_title ?? "",
    status: "unassigned" as const,
    assignedDriver: null,
  }
}

/* ─── WooCommerce payload types (subset) ─── */
interface WooAddress {
  first_name?: string
  last_name?: string
  address_1?: string
  address_2?: string
  city?: string
  state?: string
  postcode?: string
  country?: string
  phone?: string
  email?: string
}

interface WooLineItem {
  name?: string
  quantity?: number
  total?: string
  meta_data?: Array<{ key?: string; value?: string; display_key?: string; display_value?: string }>
}

interface WooOrder {
  id: number
  number?: string
  status?: string
  date_created?: string      // local time ISO-8601 from WooCommerce
  date_created_gmt?: string  // UTC ISO-8601 from WooCommerce
  total?: string
  total_tax?: string
  shipping_total?: string
  discount_total?: string
  customer_note?: string
  payment_method_title?: string
  billing?: WooAddress
  shipping?: WooAddress
  line_items?: WooLineItem[]
}

/* ─── POST handler ─── */
export async function POST(req: Request) {
  // Rate limiting
  const rateLimitResponse = await checkRateLimit(getRateLimitIdentifier(req))
  if (rateLimitResponse) return rateLimitResponse

  const rawBody = await req.text()

  // Verify HMAC signature before processing any request (including pings).
  // Fail closed in production if secret is not configured.
  if (!WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === "production") {
      log.error("WOOCOMMERCE_WEBHOOK_SECRET not configured — rejecting webhook")
      return NextResponse.json(
        { ok: false, error: "Webhook not configured" },
        { status: 503 }
      )
    }
    log.warn("WOOCOMMERCE_WEBHOOK_SECRET not configured — accepting unsigned webhook (development only)")
  } else {
    const sig = req.headers.get("x-wc-webhook-signature")
    if (!verifySignature(rawBody, sig)) {
      return NextResponse.json(
        { ok: false, error: "Invalid signature" },
        { status: 401 }
      )
    }
  }

  // WooCommerce sends a ping with topic "store.ping" on creation – ack it after verifying signature.
  const topic = req.headers.get("x-wc-webhook-topic") ?? ""
  if (topic === "store.ping" || topic === "action.wc_webhook_ping") {
    return NextResponse.json({ ok: true, message: "pong" })
  }

  let wc: WooOrder
  try {
    wc = JSON.parse(rawBody) as WooOrder
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  if (!wc.id) {
    return NextResponse.json(
      { ok: false, error: "Missing order id" },
      { status: 400 }
    )
  }

  // Only accept Processing or Completed orders
  if (wc.status !== "completed" && wc.status !== "processing") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: `Status "${wc.status}" not accepted – only processing or completed orders are imported`,
    })
  }

  // Reject orders older than 7 days — prevents WooCommerce webhook retries / backlog
  // from importing historical orders every time the webhook is re-registered.
  const MAX_ORDER_AGE_DAYS = 7
  const rawDate = wc.date_created_gmt ?? wc.date_created
  if (rawDate) {
    const createdAt = new Date(rawDate)
    const ageMs = Date.now() - createdAt.getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    if (ageDays > MAX_ORDER_AGE_DAYS) {
      log.info({ orderNumber: `${wc.number ?? wc.id}`, ageDays: ageDays.toFixed(1) }, "Skipping stale order")
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: `Order is ${ageDays.toFixed(1)} days old – only orders within ${MAX_ORDER_AGE_DAYS} days are imported`,
      })
    }
  }

  const orderNumber = `${wc.number ?? wc.id}`.replace(/^WC-/i, "")

  // Deduplicate – skip if already imported
  if (await orderExists(orderNumber)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: `Order ${orderNumber} already exists`,
    })
  }

  try {
    const order = mapWooOrder(wc)
    const orderDocId = `woo_${orderNumber}`
    const existing = await adminDb.collection("orders").doc(orderDocId).get()
    if (existing.exists) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: `Order ${orderNumber} already exists`,
      })
    }

    const id = await adminCreateOrderWithId(orderDocId, order)

    log.info({ orderId: id, orderNumber }, "WooCommerce order imported")
    await audit({ action: "order.created", resourceId: id, resourceType: "order", details: { source: "woocommerce", orderNumber } })

    return NextResponse.json({ ok: true, orderId: id, orderNumber })
  } catch (error) {
    log.error({ error, orderNumber }, "WooCommerce webhook error")
    return NextResponse.json(
      { ok: false, error: "Failed to create order" },
      { status: 500 }
    )
  }
}

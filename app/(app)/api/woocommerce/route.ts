import { NextResponse } from "next/server"
import { createOrder } from "@/lib/firestore"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { createHmac, timingSafeEqual } from "crypto"

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
 */
async function orderExists(orderNumber: string): Promise<boolean> {
  if (!db) return false
  const q = query(
    collection(db, "orders"),
    where("orderNumber", "==", orderNumber)
  )
  const snap = await getDocs(q)
  return !snap.empty
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

  const items = (wc.line_items ?? []).map((li) => ({
    name: li.name ?? "Item",
    qty: li.quantity ?? 1,
    price: Number(li.total) || 0,
  }))

  return {
    orderNumber: `WC-${wc.id}`,
    customerName,
    phone: shipping.phone || wc.billing?.phone || "",
    customerEmail: wc.billing?.email || null,
    address: addressParts.join(", ") || "No address provided",
    amount: Number(wc.total) || 0,
    status: "unassigned" as const,
    assignedDriver: null,
    items,
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
}

interface WooOrder {
  id: number
  status?: string
  total?: string
  billing?: WooAddress
  shipping?: WooAddress
  line_items?: WooLineItem[]
}

/* ─── POST handler ─── */
export async function POST(req: Request) {
  // WooCommerce sends a ping with topic "store.ping" on creation – ack it.
  const topic = req.headers.get("x-wc-webhook-topic") ?? ""
  if (topic === "store.ping" || topic === "action.wc_webhook_ping") {
    return NextResponse.json({ ok: true, message: "pong" })
  }

  const rawBody = await req.text()

  // Verify HMAC signature if secret is configured
  if (WEBHOOK_SECRET) {
    const sig = req.headers.get("x-wc-webhook-signature")
    if (!verifySignature(rawBody, sig)) {
      return NextResponse.json(
        { ok: false, error: "Invalid signature" },
        { status: 401 }
      )
    }
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

  // Only accept Processing or Completed statuses
  const accepted = ["processing", "completed"]
  if (wc.status && !accepted.includes(wc.status)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: `Status "${wc.status}" not accepted`,
    })
  }

  const orderNumber = `WC-${wc.id}`

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
    const id = await createOrder(order)

    return NextResponse.json({ ok: true, orderId: id, orderNumber })
  } catch (error) {
    console.error("WooCommerce webhook error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to create order" },
      { status: 500 }
    )
  }
}

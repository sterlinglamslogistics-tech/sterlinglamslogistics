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
 * Checks both stripped ("12345") and prefixed ("WC-12345") variants to
 * prevent duplicates from orders imported before the prefix was stripped.
 */
async function orderExists(orderNumber: string): Promise<boolean> {
  if (!db) return false
  const stripped = orderNumber.replace(/^WC-/i, "")
  const variants = [stripped, `WC-${stripped}`]
  const q = query(
    collection(db, "orders"),
    where("orderNumber", "in", variants)
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

  // Only accept Completed orders
  if (wc.status !== "completed") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: `Status "${wc.status}" not accepted – only completed orders are imported`,
    })
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

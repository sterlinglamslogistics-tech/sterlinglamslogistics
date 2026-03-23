type OrderEvent = "order_accepted" | "out_for_delivery" | "delivered"

interface NotificationPayload {
  orderId: string
  orderNumber: string
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  trackingUrl?: string
}

const NOTIFICATION_ENV_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_SMS_FROM",
  "TWILIO_WHATSAPP_FROM",
  "RESEND_API_KEY",
  "NOTIFY_FROM_EMAIL",
] as const

let hasLoggedEnvValidation = false

function getMissingNotificationEnvKeys() {
  return NOTIFICATION_ENV_KEYS.filter((key) => !process.env[key] || process.env[key]?.trim() === "")
}

function validateNotificationEnvOnce() {
  if (hasLoggedEnvValidation) return
  hasLoggedEnvValidation = true

  const missing = getMissingNotificationEnvKeys()
  if (missing.length === 0) {
    console.info("[notifications] Environment configuration loaded.")
    return
  }

  console.warn(
    `[notifications] Missing server env vars: ${missing.join(", ")}. ` +
      "Affected channels will be skipped or fail until configured."
  )
}

validateNotificationEnvOnce()

function asWhatsappNumber(value: string) {
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`
}

function toBasicAuth(user: string, pass: string) {
  return Buffer.from(`${user}:${pass}`).toString("base64")
}

function buildMessage(event: OrderEvent, payload: NotificationPayload) {
  const tracking = payload.trackingUrl ? `\nTrack: ${payload.trackingUrl}` : ""

  if (event === "order_accepted") {
    return `Hi ${payload.customerName}, your order ${payload.orderNumber} has been accepted and assigned to a rider.${tracking}`
  }

  if (event === "out_for_delivery") {
    return `Hi ${payload.customerName}, your order ${payload.orderNumber} is now out for delivery.${tracking}`
  }

  return `Hi ${payload.customerName}, your order ${payload.orderNumber} has been delivered. Thank you for choosing us.`
}

async function sendTwilioMessage(
  channel: "sms" | "whatsapp",
  to: string,
  body: string
) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const smsFrom = process.env.TWILIO_SMS_FROM
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM

  if (!sid || !token) return { sent: false, reason: "missing_twilio_credentials" }

  const from = channel === "sms" ? smsFrom : whatsappFrom
  if (!from) {
    return {
      sent: false,
      reason: channel === "sms" ? "missing_twilio_sms_from" : "missing_twilio_whatsapp_from",
    }
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
  const params = new URLSearchParams()
  params.set("From", channel === "whatsapp" ? asWhatsappNumber(from) : from)
  params.set("To", channel === "whatsapp" ? asWhatsappNumber(to) : to)
  params.set("Body", body)

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${toBasicAuth(sid, token)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  })

  if (!res.ok) {
    const errText = await res.text()
    return { sent: false, reason: `twilio_${channel}_error`, detail: errText }
  }

  return { sent: true }
}

async function sendEmail(to: string, subject: string, body: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.NOTIFY_FROM_EMAIL

  if (!apiKey || !from) {
    return { sent: false, reason: "missing_resend_config" }
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: body,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    return { sent: false, reason: "resend_error", detail: errText }
  }

  return { sent: true }
}

export async function sendOrderEventNotifications(event: OrderEvent, payload: NotificationPayload) {
  const body = buildMessage(event, payload)
  const subject =
    event === "order_accepted"
      ? `Order Accepted - ${payload.orderNumber}`
      : event === "out_for_delivery"
        ? `Out for Delivery - ${payload.orderNumber}`
        : `Delivered - ${payload.orderNumber}`

  const [sms, whatsapp, email] = await Promise.all([
    sendTwilioMessage("sms", payload.customerPhone, body),
    sendTwilioMessage("whatsapp", payload.customerPhone, body),
    payload.customerEmail ? sendEmail(payload.customerEmail, subject, body) : Promise.resolve({ sent: false, reason: "no_customer_email" }),
  ])

  return { sms, whatsapp, email }
}

export type { OrderEvent, NotificationPayload }

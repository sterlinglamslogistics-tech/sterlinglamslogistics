type OrderEvent = "order_accepted" | "out_for_delivery" | "delivered"

interface NotificationPayload {
  orderId: string
  orderNumber: string
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  trackingUrl?: string
}

export interface NotificationSettings {
  etaEmail: boolean
  etaWhatsapp: boolean
  etaTrigger: string
  allowEditDeliveryInstructions: boolean
  proactiveDelayAlerts: boolean
  deliveryReceiptEmail: boolean
  deliveryFeedbackEmail: boolean
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  etaEmail: true,
  etaWhatsapp: true,
  etaTrigger: "out_for_delivery",
  allowEditDeliveryInstructions: false,
  proactiveDelayAlerts: false,
  deliveryReceiptEmail: true,
  deliveryFeedbackEmail: true,
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function getLogoUrl(payload: NotificationPayload) {
  if (payload.trackingUrl) {
    try {
      const url = new URL(payload.trackingUrl)
      return `${url.origin}/placeholder-logo.png`
    } catch {
      // Ignore invalid tracking URL and fall back to production domain.
    }
  }

  return "https://sterlinglamslogistics.com/placeholder-logo.png"
}

function buildEmailTemplate(event: OrderEvent, payload: NotificationPayload) {
  const customerName = escapeHtml(payload.customerName?.trim() || "Glam Star")
  const orderNumber = escapeHtml(payload.orderNumber)
  const trackingUrl = payload.trackingUrl ? escapeHtml(payload.trackingUrl) : ""
  const logoUrl = escapeHtml(getLogoUrl(payload))

  if (event === "out_for_delivery") {
    return `
      <div style="margin:0;background-color:#f7f4f5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #f0d6e2;">
          <tr>
            <td style="padding:32px 32px 20px;text-align:center;background:linear-gradient(180deg,#fff7fb 0%,#ffffff 100%);">
              <img src="${logoUrl}" alt="Sterlin Glams Logistics" width="124" height="124" style="display:block;margin:0 auto 16px;max-width:124px;height:auto;" />
              <div style="font-size:24px;line-height:32px;font-weight:700;color:#c21874;">Your Order Is On The Way</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:26px;">Hello ${customerName},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:26px;">Thank you for shopping with Sterlin Glams. We&rsquo;re happy to let you know that your order <strong>${orderNumber}</strong> is now out for delivery.</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:26px;">You may track your order using the link below for real-time updates.</p>
              ${trackingUrl ? `<div style="margin:0 0 28px;"><a href="${trackingUrl}" style="display:inline-block;background:#e91e8c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 22px;border-radius:999px;">Track Your Order</a></div>` : ""}
              ${trackingUrl ? `<p style="margin:0 0 24px;font-size:13px;line-height:22px;color:#6b7280;word-break:break-word;">If the button does not work, copy and paste this link into your browser:<br />${trackingUrl}</p>` : ""}
              <p style="margin:0 0 12px;font-size:16px;line-height:26px;">Thank you for choosing Sterlin Glams.</p>
              <p style="margin:0;font-size:16px;line-height:26px;">Warm regards,<br /><strong>Sterlin Glams Logistics</strong></p>
            </td>
          </tr>
        </table>
      </div>
    `
  }

  const fallbackMessage = escapeHtml(buildMessage(event, payload)).replaceAll("\n", "<br />")

  return `
    <div style="margin:0;background-color:#f7f4f5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #f0d6e2;">
        <tr>
          <td style="padding:32px 32px 20px;text-align:center;background:linear-gradient(180deg,#fff7fb 0%,#ffffff 100%);">
            <img src="${logoUrl}" alt="Sterlin Glams Logistics" width="124" height="124" style="display:block;margin:0 auto 16px;max-width:124px;height:auto;" />
            <div style="font-size:22px;line-height:30px;font-weight:700;color:#c21874;">Sterlin Glams Logistics</div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px;font-size:16px;line-height:26px;">${fallbackMessage}</td>
        </tr>
      </table>
    </div>
  `
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

async function sendEmailNotification(
  to: string,
  subject: string,
  body: string,
  event: OrderEvent,
  payload: NotificationPayload,
) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.NOTIFY_FROM_EMAIL

  if (!apiKey || !from) {
    return { sent: false, reason: "missing_resend_config" }
  }

  const html = buildEmailTemplate(event, payload)

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
      html,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    return { sent: false, reason: "resend_error", detail: errText }
  }

  return { sent: true }
}

export async function sendOrderEventNotifications(
  event: OrderEvent,
  payload: NotificationPayload,
  settings: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
) {
  const body = buildMessage(event, payload)
  const subject =
    event === "order_accepted"
      ? `Order Accepted - ${payload.orderNumber}`
      : event === "out_for_delivery"
        ? `Out for Delivery - ${payload.orderNumber}`
        : `Delivered - ${payload.orderNumber}`

  // ETA notifications (order_accepted / out_for_delivery) — respect trigger + channel toggles
  const isEtaEvent = event === "order_accepted" || event === "out_for_delivery"
  const etaTriggerMap: Record<string, OrderEvent> = {
    order_accepted: "order_accepted",
    out_for_delivery: "out_for_delivery",
    picked_up: "out_for_delivery",
  }
  const triggerEvent = etaTriggerMap[settings.etaTrigger] ?? "out_for_delivery"

  let doSms = true
  let doWhatsapp = true
  let doEmail = true

  if (isEtaEvent) {
    const shouldSendEta = event === triggerEvent || event === "out_for_delivery"
    doSms = shouldSendEta
    doWhatsapp = shouldSendEta && settings.etaWhatsapp
    doEmail = shouldSendEta && settings.etaEmail
  }

  if (event === "delivered") {
    doEmail = settings.deliveryReceiptEmail
  }

  const [sms, whatsapp, email] = await Promise.all([
    doSms
      ? sendTwilioMessage("sms", payload.customerPhone, body)
      : Promise.resolve({ sent: false, reason: "disabled_by_settings" }),
    doWhatsapp
      ? sendTwilioMessage("whatsapp", payload.customerPhone, body)
      : Promise.resolve({ sent: false, reason: "disabled_by_settings" }),
    doEmail && payload.customerEmail
      ? sendEmailNotification(payload.customerEmail, subject, body, event, payload)
      : Promise.resolve({ sent: false, reason: doEmail ? "no_customer_email" : "disabled_by_settings" }),
  ])

  return { sms, whatsapp, email }
}

export type { OrderEvent, NotificationPayload }

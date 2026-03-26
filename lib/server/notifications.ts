type OrderEvent = "order_accepted" | "out_for_delivery" | "delivered"

interface NotificationPayload {
  orderId: string
  orderNumber: string
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  trackingUrl?: string
  address?: string
  driverName?: string
  items?: Array<{ name: string; qty?: number; price?: number }>
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

function getSiteOrigin(payload: NotificationPayload) {
  if (payload.trackingUrl) {
    try {
      return new URL(payload.trackingUrl).origin
    } catch {
      // Ignore invalid tracking URL and fall back to production domain.
    }
  }

  return "https://sterlinglamslogistics.com"
}

function buildRatingUrl(siteOrigin: string, trackingToken: string, rating: number) {
  return `${siteOrigin}/api/ratings/${encodeURIComponent(trackingToken)}?rating=${rating}`
}

function renderSummaryRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:0 0 12px;color:#6b7280;font-size:13px;line-height:20px;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(label)}</td>
      <td style="padding:0 0 12px;color:#1f1f1f;font-size:14px;line-height:20px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
    </tr>
  `
}

function renderSocialLinks(siteOrigin: string) {
  const socials = [
    { label: "Instagram", href: "https://www.instagram.com/Sterlinglamsofficial/" },
    { label: "Facebook", href: "https://www.facebook.com/sterlinglams/" },
    { label: "TikTok", href: "https://www.tiktok.com/@sterlinglams" },
  ]

  const items = socials
    .map(
      (social) =>
        `<a href="${social.href}" style="display:inline-block;margin:0 8px;color:#c21874;text-decoration:none;font-size:13px;font-weight:700;">${social.label}</a>`
    )
    .join("")

  return `
    <p style="margin:0 0 8px;font-size:13px;line-height:22px;color:#6b7280;">Stay connected with Sterlin Glams</p>
    <div style="margin:0 0 16px;">${items}</div>
    <p style="margin:0;font-size:12px;line-height:20px;color:#9ca3af;">Tracking portal: <a href="${siteOrigin}" style="color:#c21874;text-decoration:none;">${siteOrigin}</a></p>
  `
}

function renderItemsTable(items: Array<{ name: string; qty?: number; price?: number }>) {
  if (!items.length) return ""

  const rows = items
    .map((item) => {
      const qty = typeof item.qty === "number" && item.qty > 0 ? `&times;${item.qty}` : ""
      const price =
        typeof item.price === "number"
          ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(item.price)
          : ""
      return `
        <tr>
          <td style="padding:4px 0;color:#1f1f1f;font-size:13px;line-height:20px;">${escapeHtml(item.name)} ${qty}</td>
          <td style="padding:4px 0;color:#1f1f1f;font-size:13px;line-height:20px;text-align:right;font-weight:600;">${price}</td>
        </tr>`
    })
    .join("")

  return `
    <div style="margin:0 0 12px;font-size:13px;line-height:20px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;">Items</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 12px;border-bottom:1px solid #f5d1e3;padding-bottom:8px;">${rows}</table>`
}

function buildEmailTemplate(event: OrderEvent, payload: NotificationPayload) {
  const customerName = escapeHtml(payload.customerName?.trim() || "Glam Star")
  const orderNumber = escapeHtml(payload.orderNumber)
  const trackingUrl = payload.trackingUrl ? escapeHtml(payload.trackingUrl) : ""
  const logoUrl = escapeHtml(getLogoUrl(payload))
  const siteOrigin = escapeHtml(getSiteOrigin(payload))
  const statusLabel =
    event === "order_accepted"
      ? "Accepted"
      : event === "out_for_delivery"
        ? "Out for delivery"
        : "Delivered"
  const etaLabel = event === "delivered" ? "Completed" : trackingUrl ? "Live ETA on tracking page" : "In progress"
  const summaryRows = [
    renderSummaryRow("Order", payload.orderNumber),
    renderSummaryRow("Status", statusLabel),
    ...(payload.driverName ? [renderSummaryRow("Driver", payload.driverName)] : []),
    ...(payload.address ? [renderSummaryRow("Address", payload.address)] : []),
    renderSummaryRow("ETA", etaLabel),
  ].join("")

  const itemsHtml = payload.items?.length ? renderItemsTable(payload.items) : ""

  const layoutStart = `
    <div style="margin:0;background-color:#f7f4f5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #f0d6e2;box-shadow:0 18px 50px rgba(233,30,140,.08);">
        <tr>
          <td style="padding:32px 32px 20px;text-align:center;background:linear-gradient(180deg,#fff7fb 0%,#ffffff 100%);">
            <img src="${logoUrl}" alt="Sterlin Glams Logistics" width="124" height="124" style="display:block;margin:0 auto 16px;max-width:124px;height:auto;border:0;outline:none;text-decoration:none;" />
  `

  const summaryCard = `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #f5d1e3;border-radius:16px;background:#fff8fc;">
              <tr>
                <td style="padding:18px 20px;">
                  <div style="margin:0 0 12px;font-size:15px;line-height:22px;font-weight:700;color:#1f1f1f;">Order summary</div>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${summaryRows}</table>
                  ${itemsHtml}
                </td>
              </tr>
            </table>
  `

  if (event === "order_accepted") {
    const driverLine = payload.driverName
      ? ` Your rider <strong>${escapeHtml(payload.driverName)}</strong> will be handling the delivery.`
      : " A rider has been assigned and will be on the way soon."

    return `
      ${layoutStart}
              <div style="font-size:24px;line-height:32px;font-weight:700;color:#c21874;">Your Order Has Been Accepted</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              ${summaryCard}
              <p style="margin:0 0 16px;font-size:16px;line-height:26px;">Hello ${customerName},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:26px;">Thank you for shopping with Sterlin Glams. We&rsquo;re happy to let you know that your order <strong>${orderNumber}</strong> has been accepted and is being prepared.${driverLine}</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:26px;">We&rsquo;ll send you another update once your order is on the way. You can track your order at any time using the link below.</p>
              ${trackingUrl ? `<div style="margin:0 0 28px;"><a href="${trackingUrl}" style="display:inline-block;background:#e91e8c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 22px;border-radius:999px;">Track Your Order</a></div>` : ""}
              ${trackingUrl ? `<p style="margin:0 0 24px;font-size:13px;line-height:22px;color:#6b7280;word-break:break-word;">If the button does not work, copy and paste this link into your browser:<br />${trackingUrl}</p>` : ""}
              <p style="margin:0 0 12px;font-size:16px;line-height:26px;">Thank you for choosing Sterlin Glams.</p>
              <p style="margin:0;font-size:16px;line-height:26px;">Warm regards,<br /><strong>Sterlin Glams Logistics</strong></p>
              <div style="margin:28px 0 0;padding-top:20px;border-top:1px solid #f3e4eb;text-align:center;">
                ${renderSocialLinks(siteOrigin)}
              </div>
            </td>
          </tr>
        </table>
      </div>
    `
  }

  if (event === "out_for_delivery") {
    return `
      ${layoutStart}
              <div style="font-size:24px;line-height:32px;font-weight:700;color:#c21874;">Your Order Is On The Way</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              ${summaryCard}
              <p style="margin:0 0 16px;font-size:16px;line-height:26px;">Hello ${customerName},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:26px;">Thank you for shopping with Sterlin Glams. We&rsquo;re happy to let you know that your order <strong>${orderNumber}</strong> is now out for delivery.</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:26px;">You may track your order using the link below for real-time updates.</p>
              ${trackingUrl ? `<div style="margin:0 0 28px;"><a href="${trackingUrl}" style="display:inline-block;background:#e91e8c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 22px;border-radius:999px;">Track Your Order</a></div>` : ""}
              ${trackingUrl ? `<p style="margin:0 0 24px;font-size:13px;line-height:22px;color:#6b7280;word-break:break-word;">If the button does not work, copy and paste this link into your browser:<br />${trackingUrl}</p>` : ""}
              <p style="margin:0 0 12px;font-size:16px;line-height:26px;">Thank you for choosing Sterlin Glams.</p>
              <p style="margin:0;font-size:16px;line-height:26px;">Warm regards,<br /><strong>Sterlin Glams Logistics</strong></p>
              <div style="margin:28px 0 0;padding-top:20px;border-top:1px solid #f3e4eb;text-align:center;">
                ${renderSocialLinks(siteOrigin)}
              </div>
            </td>
          </tr>
        </table>
      </div>
    `
  }

  if (event === "delivered") {
    const ratingBlock = trackingUrl
      ? `<div style="margin:28px 0 0;padding:20px;border:1px solid #f5d1e3;border-radius:16px;background:#fff8fc;text-align:center;">
           <div style="margin:0 0 10px;font-size:16px;line-height:24px;font-weight:700;color:#1f1f1f;">Rate your delivery experience</div>
           <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#6b7280;">Tap a rating below to share quick feedback.</p>
           <div>
             ${[1, 2, 3, 4, 5]
               .map((rating) => `<a href="${escapeHtml(buildRatingUrl(getSiteOrigin(payload), payload.orderNumber, rating))}" style="display:inline-block;margin:0 6px;font-size:24px;line-height:24px;text-decoration:none;color:#e91e8c;">★</a>`)
               .join("")}
           </div>
         </div>`
      : ""

    return `
      ${layoutStart}
              <div style="font-size:24px;line-height:32px;font-weight:700;color:#c21874;">Your Order Has Been Delivered</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              ${summaryCard}
              <p style="margin:0 0 16px;font-size:16px;line-height:26px;">Hello ${customerName},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:26px;">Thank you for shopping with Sterlin Glams. We&rsquo;re pleased to confirm that your order <strong>${orderNumber}</strong> has been delivered successfully.</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:26px;">We hope everything arrived exactly as expected. You can still open your tracking page below for your delivery record and updates.</p>
              ${trackingUrl ? `<div style="margin:0 0 28px;"><a href="${trackingUrl}" style="display:inline-block;background:#e91e8c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 22px;border-radius:999px;">View Delivery Details</a></div>` : ""}
              ${ratingBlock}
              <p style="margin:28px 0 12px;font-size:16px;line-height:26px;">Thank you for choosing Sterlin Glams.</p>
              <p style="margin:0;font-size:16px;line-height:26px;">Warm regards,<br /><strong>Sterlin Glams Logistics</strong></p>
              <div style="margin:28px 0 0;padding-top:20px;border-top:1px solid #f3e4eb;text-align:center;">
                ${renderSocialLinks(siteOrigin)}
              </div>
            </td>
          </tr>
        </table>
      </div>
    `
  }

  // Fallback for any future event types
  const fallbackMessage = escapeHtml(buildMessage(event, payload)).replaceAll("\n", "<br />")

  return `
    ${layoutStart}
            <div style="font-size:22px;line-height:30px;font-weight:700;color:#c21874;">Sterlin Glams Logistics</div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px;">
            ${summaryCard}
            <p style="font-size:16px;line-height:26px;">${fallbackMessage}</p>
            <div style="margin:28px 0 0;padding-top:20px;border-top:1px solid #f3e4eb;text-align:center;">
              ${renderSocialLinks(siteOrigin)}
            </div>
          </td>
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
      from: `Sterlin Glams <${from}>`,
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

# WooCommerce → Sterlinglams Delivery Integration

Automatically receive WooCommerce orders from **sterlinglam.com** when they hit **Processing** or **Completed**.

---

## 1. Generate a Webhook Secret

Pick any strong random string (e.g. `openssl rand -hex 32`). You'll use it in both WooCommerce and Vercel.

---

## 2. Add the Secret to Vercel

1. Go to **Vercel → Project Settings → Environment Variables**
2. Add:

   | Name | Value |
   |------|-------|
   | `WOOCOMMERCE_WEBHOOK_SECRET` | *(your secret from step 1)* |

3. Redeploy (or it picks up on next push).

---

## 3. Create Webhooks in WooCommerce

Go to **sterlinglam.com → WP Admin → WooCommerce → Settings → Advanced → Webhooks**.

### Webhook A – Processing Orders

| Field | Value |
|-------|-------|
| **Name** | Sterlinglams Delivery – Processing |
| **Status** | Active |
| **Topic** | Order updated |
| **Delivery URL** | `https://sterlinglamslogistics.com/api/woocommerce` |
| **Secret** | *(same secret from step 1)* |
| **API Version** | WP REST API Integration v3 |

### Webhook B – Completed Orders

| Field | Value |
|-------|-------|
| **Name** | Sterlinglams Delivery – Completed |
| **Status** | Active |
| **Topic** | Order updated |
| **Delivery URL** | `https://sterlinglamslogistics.com/api/woocommerce` |
| **Secret** | *(same secret from step 1)* |
| **API Version** | WP REST API Integration v3 |

> **Tip**: You can use a single "Order updated" webhook instead of two. The endpoint already filters by status and only imports orders with `processing` or `completed`.

---

## 4. How It Works

1. Customer places order on **sterlinglam.com** → WooCommerce sets status to **Processing**
2. WooCommerce fires webhook → POSTs the full order JSON to `/api/woocommerce`
3. The endpoint:
   - Verifies the HMAC-SHA256 signature (`x-wc-webhook-signature` header)
   - Rejects statuses other than `processing` / `completed`
   - Deduplicates by order number (`WC-{woo_id}`)
   - Maps customer name, address, phone, email, line items, and total
   - Creates an **unassigned** order in Firestore (auto-calculates distance)
4. The order appears in the **Sterlinglams Delivery** admin dashboard immediately

---

## 5. Order Number Format

WooCommerce orders are prefixed with `WC-` followed by the WooCommerce order ID:

- WooCommerce order **#1234** → Delivery order **1234**

---

## 6. Testing

1. In WooCommerce, click **Ping** on the webhook to verify connectivity (should return `200 OK`)
2. Place a test order on sterlinglam.com and move it to **Processing**
3. Check the Sterlinglams Delivery dashboard — the order should appear within seconds

# SG-Delivery — Project Status & Completion Checklist

**Last updated:** April 21, 2026  
**Live site:** https://sterlinglamslogistics.com  
**Repo:** https://github.com/sterlinglamslogistics-tech/sterlinglamslogistics  
**Deployed on:** Vercel (auto-deploys on push to `main`)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5.7 (strict) |
| UI | shadcn/ui + Tailwind CSS v4 + Radix primitives |
| Database | Firebase Firestore |
| Auth | Firebase Auth (admin login) |
| File Storage | Firebase Storage (logo upload) |
| SMS / WhatsApp | Twilio |
| Email | Resend |
| Maps | Google Maps API |
| Rate Limiting | Upstash Redis |
| Error Tracking | Sentry |
| Logging | Pino (structured) |
| Mobile App | Capacitor (Android) — in `driver-mobile/` |
| Hosting | Vercel + Hostinger CDN |
| Package Manager | pnpm 9.15.4 |

---

## 2. Everything Built So Far

### 2a. Pages & Features

#### Public-facing
| Page | Path | Status |
|---|---|---|
| Landing page | `/` | ✅ Done — hero, tracking form, how-it-works, features, footer |
| Order tracking | `/track/[tracking]` | ✅ Done — live status steps, driver info, ETA, delivery proof photo, customer rating |
| Login | `/login` | ✅ Done — Firebase Auth |

#### Admin app (`/(app)/`)
| Page | Path | Status |
|---|---|---|
| Dashboard | `/dashboard` | ✅ Done — order stats, driver status overview |
| Orders | `/orders` | ✅ Done — list, assign driver, bulk assign, reassign, status badges, order detail dialog, print label/waybill |
| Dispatch | `/dispatch` | ✅ Done — drag-and-drop route ordering, driver select, assign & notify |
| Drivers | `/drivers` | ✅ Done — create/edit/delete, reset password, end shift, driver profile |
| Routes | `/routes` | ✅ Done (existing) |
| Reports | `/reports` | ✅ Done (existing) |
| Reviews | `/reviews` | ✅ Done (existing) |
| Settings — Business | `/settings` → Business tab | ✅ Done — company name, address, phone, logo upload |
| Settings — Notification | `/settings` → Notification tab | ✅ Done — email/WhatsApp toggles, trigger timing |
| Settings — Driver | `/settings` → Driver tab | ✅ Done — 11 feature toggles |
| Settings — Dispatch, Route, Users, Location | `/settings` → other tabs | ⚠️ Placeholder "coming soon" panels |

#### Driver mobile app (`/(app)/driver/`)
| Screen | Path | Status |
|---|---|---|
| Driver shell / tabs | `/driver` | ✅ Done |
| Dashboard (active orders) | `/driver/dashboard` | ✅ Done |
| Order detail | `/driver/order/[orderId]` | ✅ Done |
| Delivery flow | `/driver/delivery/[orderId]` | ✅ Done — mark picked-up, in-transit, delivered, proof photo |
| Completed orders | `/driver/completed-orders` | ✅ Done |
| Performance | `/driver/performance` | ✅ Done |
| Map | `/driver/map` | ✅ Done |
| Messages | `/driver/messages` | ✅ Done |
| Settings | `/driver/settings` | ✅ Done |
| Language | `/driver/language` | ✅ Done |
| Waiting screen | `/driver/waiting` | ✅ Done |

#### API Routes
| Route | Method | Purpose | Status |
|---|---|---|---|
| `/api/notifications/order-event` | POST | Triggers SMS, WhatsApp, email on order status change | ✅ Done — admin-only (Firebase ID token + admin claim) |
| `/api/ratings/[tracking]` | GET, POST | GET redirects to tracking page with rating param; POST saves rating | ✅ Done — public, rate-limited |
| `/api/woocommerce` | POST | Receives WooCommerce order webhooks | ✅ Done — HMAC-verified, fails closed if secret unset in production |
| `/api/admin/clean-orders` | POST | Admin utility — purge old orders, dedupe, backfill coords | ✅ Done — admin-only, rate-limited |
| `/api/admin/drivers` | POST | Create / update / delete / reset_password / set_offline driver | ✅ Done — admin-only |
| `/api/admin/dispatch/assign` | POST | Assign or unassign an order to a driver | ✅ Done — admin-only |
| `/api/admin/dispatch/reorder` | POST | Save optimized route order | ✅ Done — admin-only |
| `/api/driver/login` | POST | Driver phone+password auth, issues session token cookie | ✅ Done — rate-limited |
| `/api/driver/profile` | POST | Driver self-update profile | ✅ Done — driver session-verified |
| `/api/driver/status` | POST | Driver toggles available / on-delivery / offline | ✅ Done — driver session-verified |
| `/api/driver/location` | POST | Driver GPS coordinate update (5s throttle) | ✅ Done — driver session-verified |
| `/api/driver/orders/[orderId]/status` | POST | Driver marks picked-up / in-transit / delivered | ✅ Done — driver session-verified |

---

### 2b. Libraries & Utilities Built

| File | Purpose |
|---|---|
| `lib/constants.ts` | Single source of truth for all status strings (`ORDER_STATUS`, `DRIVER_STATUS`, etc.) |
| `lib/env.ts` | Zod-based env var validation at startup |
| `lib/logger.ts` | Structured logging with pino |
| `lib/audit.ts` | Audit trail — writes every admin action to Firestore `auditLogs` collection |
| `lib/rate-limit.ts` | Upstash Redis rate limiting (fail-closed in production) |
| `lib/password.ts` | bcrypt password hashing for driver accounts |
| `lib/validations.ts` | Shared Zod schemas for API request validation |
| `lib/order-utils.ts` | Print waybill / label helpers with XSS escaping |
| `lib/server/firebase-admin.ts` | Firebase Admin SDK init (for server-side auth) |
| `lib/server/auth.ts` | `verifyAdmin()` — checks Firebase ID token + admin claim on API routes |
| `lib/server/notifications.ts` | Full SMS / WhatsApp / email send logic via Twilio + Resend |
| `lib/notify-client.ts` | Client-side helper to call the notification API |

### 2c. Components Built
| Component | Purpose |
|---|---|
| `components/orders/status-badge.tsx` | Shared coloured badge for order statuses |
| `components/orders/order-detail-dialog.tsx` | Full order detail modal |
| `components/orders/reassign-dialog.tsx` | Reassign / assign driver dialog |
| `components/orders/bulk-assign-dialog.tsx` | Bulk assign dialog |
| `components/settings/business-settings.tsx` | Business settings panel |
| `components/settings/notification-settings.tsx` | Customer notification settings panel |
| `components/settings/driver-settings.tsx` | Driver feature-flag settings panel |
| `components/error-boundary.tsx` | React error boundary with retry |

### 2d. Security Improvements Done
- ✅ Passwords hashed with bcrypt (was plaintext before). Note: `verifyPassword` still has a legacy plaintext-fallback branch — see Known Issues
- ✅ Rate limiting on all API routes (admin and driver routes included)
- ✅ Zod validation on the notification API request body
- ✅ XSS escaping in print/waybill HTML output and email templates
- ✅ Admin API routes protected with Firebase Auth ID token + `admin` custom claim check
- ✅ Driver API routes protected with HMAC-signed session tokens (cookie + `X-Driver-Token` header for Capacitor WebView). Transitional fallback to body `driverId` while the deployed driver app re-authenticates — search logs for `[driver-auth] using bodyId without session token`
- ✅ WooCommerce webhook fails closed in production when `WOOCOMMERCE_WEBHOOK_SECRET` is unset
- ✅ `ignoreBuildErrors` removed from Next config
- ✅ Proxy (`proxy.ts`, the Next.js 16 successor to `middleware.ts`) sets `no-store` cache headers to prevent CDN caching of HTML
- ✅ `firestore.rules` checked into the repo (deploy with `firebase deploy --only firestore:rules` after migrating server writes to firebase-admin SDK)

### 2e. Notifications — How They Work Now
| Event | Trigger | SMS | WhatsApp | Email | Sent from |
|---|---|---|---|---|---|
| Order Accepted | Admin assigns a driver | ✅ | ✅ (if enabled in settings) | ✅ (if enabled) | Admin client → `/api/notifications/order-event` (admin-token verified) |
| Out for Delivery | Driver taps "Mark as On the Way" | ✅ | ✅ | ✅ | **Server-side from `/api/driver/orders/[orderId]/status`** — no client notification call required |
| Delivered | Driver taps "Mark as Delivered" | ✅ | ✅ | ✅ + optional feedback email | **Server-side from `/api/driver/orders/[orderId]/status`** |

#### WhatsApp setup (production / Business)
The send path uses Twilio Content Templates via Messaging Service when both env vars are set:

```
TWILIO_WHATSAPP_MESSAGING_SERVICE_SID=MG...
TWILIO_WHATSAPP_CONTENT_SID=HX...
```

Configure your approved template using these positional placeholders:
- `{{1}}` customer name
- `{{2}}` order number
- `{{3}}` status text — `"is on the way"` / `"has been delivered"` / `"has been accepted"`
- `{{4}}` tracking URL

Optional per-event overrides: `TWILIO_WHATSAPP_CONTENT_SID_ORDER_ACCEPTED`, `TWILIO_WHATSAPP_CONTENT_SID_OUT_FOR_DELIVERY`, `TWILIO_WHATSAPP_CONTENT_SID_DELIVERED`.

When the Messaging Service / Content SID are not set, the code falls back to `From=` + `Body=` mode — works for the WhatsApp **sandbox** and within the 24-hour customer-initiated session, but **not** for first-contact production messages.

Phone numbers are normalized to E.164 (`+2348012345678`) before sending, so Firestore can store `"0801 234 5678"` or any common variant and Twilio still accepts the request.

**WhatsApp "on the way" message includes:**
- Driver name
- Order number
- Delivery address
- Live tracking link: `https://sterlinglamslogistics.com/track/[orderNumber]`

### 2f. Tests Written
| File | Tests |
|---|---|
| `__tests__/constants.test.ts` | 5 tests — status values, arrays |
| `__tests__/validations.test.ts` | 9 tests — Zod schemas |
| `__tests__/password.test.ts` | 5 tests — bcrypt hashing |

Run with: `pnpm test`

---

## 3. What's Still Needed to Go Live

### 🔴 CRITICAL — App will not work without these

#### 3a. Vercel Environment Variables
Go to **Vercel → Project → Settings → Environment Variables** and set all of these:

```
# Driver session signing key — used by HMAC token system in lib/server/driver-session.ts
# Set this to a 32+ character random string. If unset, the system derives a key from
# FIREBASE_SERVICE_ACCOUNT_KEY (works but is not stable if the service account changes).
DRIVER_SESSION_SECRET=

# Firebase (client-side) — copy from your Firebase Console → Project Settings → Web App
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server-side) — download Service Account JSON from Firebase Console → Project Settings → Service Accounts
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}   ← paste the full JSON as a single line

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_KEY=

# Delivery hub coordinates (used for route optimization)
NEXT_PUBLIC_HUB_LAT=
NEXT_PUBLIC_HUB_LNG=
```

#### 3b. Twilio Setup (SMS + WhatsApp)
1. Sign in at https://twilio.com
2. Go to **Console → Phone Numbers** — get your SMS number
3. Go to **Messaging → Try it out → Send a WhatsApp message** — get your WhatsApp sandbox number OR activate a WhatsApp Business sender
4. Add to Vercel env vars:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_SMS_FROM=+1xxxxxxxxxx          ← your Twilio SMS number
TWILIO_WHATSAPP_FROM=+1xxxxxxxxxx     ← your Twilio WhatsApp number (same or different)
# OR, for WhatsApp via a Twilio Messaging Service, use this instead of TWILIO_WHATSAPP_FROM:
TWILIO_WHATSAPP_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# For business-initiated WhatsApp notifications outside the 24-hour reply window:
TWILIO_WHATSAPP_CONTENT_SID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
5. **Important:** Every customer phone number in Firestore must be in E.164 format: `+2348012345678` (country code first, no spaces/dashes)

#### 3c. Resend Setup (Email)
1. Sign in at https://resend.com
2. Add and verify your sending domain (e.g. `sterlinglamslogistics.com`)
3. Create an API key
4. Add to Vercel env vars:
```
RESEND_API_KEY=re_xxxxxxxxxxxx
NOTIFY_FROM_EMAIL=noreply@sterlinglamslogistics.com
```

#### 3d. WooCommerce Webhook (Auto-import orders)
1. In your WordPress admin → **WooCommerce → Settings → Advanced → Webhooks**
2. Create a new webhook:
   - **Status:** Active
   - **Topic:** Order created
   - **Delivery URL:** `https://sterlinglamslogistics.com/api/woocommerce`
   - **Secret:** generate a random secret string
3. Add to Vercel env vars:
```
WOOCOMMERCE_WEBHOOK_SECRET=your_random_secret
```

---

### 🟡 RECOMMENDED — Rate Limiting & Error Tracking

#### 3e. Upstash Redis (Rate Limiting)
Without this, rate limiting is disabled in production (currently returns 503 if not set).
1. Sign up at https://upstash.com → Create a Redis database
2. Add to Vercel env vars:
```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxxxxxxxxx
```

#### 3f. Sentry (Error Tracking)
1. Sign up at https://sentry.io → Create a Next.js project
2. Add to Vercel env vars:
```
SENTRY_DSN=https://xxx@oXXX.ingest.sentry.io/xxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=sntrys_xxx   ← for source map uploads at build time
```

---

### 🟢 NICE TO HAVE — Settings Pages Not Yet Built

These settings tabs exist in the UI but show "coming soon":

| Tab | What it would control |
|---|---|
| **Dispatch settings** | Auto-assign logic, dispatch cutoff time |
| **Route settings** | Route optimization preferences, max stops per driver |
| **Users / Team** | Invite admin users, manage roles |
| **Location settings** | Hub address, service area zones, geofencing |

---

## 4. Android Driver App

The Capacitor Android app lives in `driver-mobile/`. It wraps the `/driver` web route.

To build and deploy the APK:
```bash
pnpm driver:mobile:sync       # syncs web files into Android project
pnpm driver:mobile:open       # opens Android Studio
```
Then in Android Studio: **Build → Generate Signed APK**.

See `DRIVER_APK_SETUP.md` for the full guide.

**Required env var for the app:**
```
DRIVER_APP_URL=https://sterlinglamslogistics.com/driver
```

---

## 5. Firestore Collections Reference

| Collection | Purpose |
|---|---|
| `orders` | All delivery orders |
| `drivers` | Driver accounts (name, phone, status, password hash) |
| `settings/customerNotification` | Email/WhatsApp notification toggles |
| `settings/driverSettings` | Driver app feature flags |
| `settings/businessInfo` | Company name, logo, address |
| `notificationLogs` | Log of every SMS/WhatsApp/email sent |
| `auditLogs` | Admin action audit trail |

See `SETUP_FIRESTORE.md` and `FIREBASE_SETUP.md` for index and security rules setup.

---

## 6. Known Issues

| Issue | Severity | Notes |
|---|---|---|
| Local `pnpm build` fails on Windows with `EINVAL: node:inspector` | Low | Windows-only `standalone` copy bug. Does **not** affect Vercel Linux build. |
| Hostinger CDN was caching HTML for 1 year | Fixed | `no-store` headers in `middleware.ts` (was misnamed `proxy.ts`, fixed) — requires one-time cache purge on Hostinger dashboard |
| Settings tabs: Dispatch, Route, Users, Location are placeholder | Medium | Functional placeholders, not blocking core delivery workflow |
| `lib/password.ts` has a legacy plaintext-fallback in `verifyPassword` | Medium | Returns true for non-bcrypt stored passwords. Mitigated because `createDriver`/`updateDriver` always hash on write; risk is manual data inserts. Remove once data is verified clean. |
| Server-side writes via `lib/firestore.ts` use the **client** Firebase SDK | High | Routes (woocommerce, driver, ratings) write without auth context. Works only because Firestore rules are open today. **Migrate to `lib/server/firebase-admin.ts` (`adminDb`) before deploying the new `firestore.rules`.** |
| Driver API auth fallback to body `driverId` is transitional | Medium | Once the deployed driver-mobile APK has been rebuilt + reinstalled, remove the fallback in `lib/server/driver-auth.ts`. |
| `set-admin-claim.mjs` must be run after every new admin signup | Low | `seed-admin.mjs` now sets the claim during seeding. For admins added later via Firebase Console, run `node set-admin-claim.mjs --email=their@email` |

---

## 7. Quick Commands

```bash
pnpm dev          # start local dev server
pnpm build        # production build (will error locally on Windows — use Vercel)
pnpm test         # run all 19 unit tests
pnpm seed         # seed Firestore with sample data
pnpm seed:admin   # create an admin user
```

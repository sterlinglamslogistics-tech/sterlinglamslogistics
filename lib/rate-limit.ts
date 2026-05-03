import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextResponse } from "next/server"
import { createLogger } from "@/lib/logger"

const log = createLogger("rate-limit")

let ratelimit: Ratelimit | null = null

function getRateLimiter() {
  if (ratelimit) return ratelimit

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      log.error("Upstash Redis not configured in production — rate limiting will reject requests")
    } else {
      log.warn("Upstash Redis not configured — rate limiting disabled in development")
    }
    return null
  }

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    analytics: true,
  })

  return ratelimit
}

/**
 * Check rate limit for an identifier (e.g. IP address).
 * Returns null if allowed, or a NextResponse(429) if rate-limited.
 * If Upstash is not configured, always allows through.
 */
export async function checkRateLimit(
  identifier: string,
): Promise<NextResponse | null> {
  const limiter = getRateLimiter()
  if (!limiter) {
    // In production, fail closed — deny the request if rate limiter is unavailable
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "Service temporarily unavailable." },
        { status: 503 },
      )
    }
    return null
  }

  try {
    const result = await limiter.limit(identifier)
    if (!result.success) {
      log.warn({ identifier, remaining: result.remaining }, "Rate limit exceeded")
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(result.limit),
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(result.reset),
          },
        },
      )
    }
    return null
  } catch (err) {
    log.error({ err }, "Rate limit check failed — allowing request")
    return null
  }
}

/**
 * Extract a usable identifier from a request for rate limiting.
 */
export function getRateLimitIdentifier(req: Request): string {
  // Prefer platform-provided client IP headers before generic X-Forwarded-For.
  // This reduces spoofing risk when requests pass through trusted proxies/CDNs.
  const candidate =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-vercel-forwarded-for") ??
    req.headers.get("x-forwarded-for") ??
    ""

  const ip = candidate.split(",")[0]?.trim() || "unknown"
  return ip
}

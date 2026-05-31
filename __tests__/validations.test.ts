import { describe, it, expect } from "vitest"
import { orderEventSchema, ratingParamsSchema, driverAuthSchema } from "../lib/validations"

describe("orderEventSchema", () => {
  it("accepts a valid order event payload", () => {
    const result = orderEventSchema.safeParse({
      event: "order_accepted",
      payload: {
        orderId: "abc123",
        orderNumber: "1001",
        customerName: "John Doe",
        customerPhone: "+2348012345678",
      },
    })
    expect(result.success).toBe(true)
  })

  it("rejects an invalid event type", () => {
    const result = orderEventSchema.safeParse({
      event: "invalid_event",
      payload: {
        orderId: "abc123",
        orderNumber: "1001",
        customerName: "John",
        customerPhone: "+234801234",
      },
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing required payload fields", () => {
    const result = orderEventSchema.safeParse({
      event: "delivered",
      payload: {
        orderId: "",
        orderNumber: "1001",
        customerName: "John",
        customerPhone: "+234801234",
      },
    })
    expect(result.success).toBe(false)
  })
})

describe("ratingParamsSchema", () => {
  it("accepts a valid rating", () => {
    expect(ratingParamsSchema.safeParse({ rating: "3" }).success).toBe(true)
    expect(ratingParamsSchema.safeParse({ rating: "5" }).success).toBe(true)
  })

  it("rejects out of range ratings", () => {
    expect(ratingParamsSchema.safeParse({ rating: "0" }).success).toBe(false)
    expect(ratingParamsSchema.safeParse({ rating: "6" }).success).toBe(false)
  })

  it("rejects non-integer ratings", () => {
    expect(ratingParamsSchema.safeParse({ rating: "3.5" }).success).toBe(false)
  })
})

describe("driverAuthSchema", () => {
  it("accepts valid credentials", () => {
    const result = driverAuthSchema.safeParse({
      phone: "08012345678",
      password: "pass123",
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty phone", () => {
    const result = driverAuthSchema.safeParse({ phone: "", password: "pass" })
    expect(result.success).toBe(false)
  })

  it("rejects empty password", () => {
    const result = driverAuthSchema.safeParse({ phone: "0801234", password: "" })
    expect(result.success).toBe(false)
  })
})

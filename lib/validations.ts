import { z } from "zod"

/** Notification order-event API request body */
export const orderEventSchema = z.object({
  event: z.enum(["order_accepted", "out_for_delivery", "delivered"]),
  payload: z.object({
    orderId: z.string().min(1),
    orderNumber: z.string().min(1),
    customerName: z.string().min(1),
    customerPhone: z.string().min(1),
    customerEmail: z.string().email().nullish(),
    trackingUrl: z.string().url().optional(),
    address: z.string().optional(),
    driverName: z.string().optional(),
    items: z
      .array(
        z.object({
          name: z.string(),
          qty: z.number().optional(),
          price: z.number().optional(),
        }),
      )
      .optional(),
  }),
})

/** Rating query params */
export const ratingParamsSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
})

/** Driver auth */
export const driverAuthSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
})

import { describe, it, expect } from "vitest"
import {
  ORDER_STATUS,
  DRIVER_STATUS,
  ORDER_STATUS_LABELS,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
} from "../lib/constants"

describe("constants", () => {
  it("defines all order statuses", () => {
    expect(ORDER_STATUS.UNASSIGNED).toBe("unassigned")
    expect(ORDER_STATUS.STARTED).toBe("started")
    expect(ORDER_STATUS.PICKED_UP).toBe("picked-up")
    expect(ORDER_STATUS.IN_TRANSIT).toBe("in-transit")
    expect(ORDER_STATUS.DELIVERED).toBe("delivered")
    expect(ORDER_STATUS.FAILED).toBe("failed")
    expect(ORDER_STATUS.CANCELLED).toBe("cancelled")
  })

  it("defines all driver statuses", () => {
    expect(DRIVER_STATUS.AVAILABLE).toBe("available")
    expect(DRIVER_STATUS.ON_DELIVERY).toBe("on-delivery")
    expect(DRIVER_STATUS.OFFLINE).toBe("offline")
  })

  it("has labels for all order statuses", () => {
    const statusValues = Object.values(ORDER_STATUS)
    for (const status of statusValues) {
      expect(ORDER_STATUS_LABELS[status]).toBeDefined()
      expect(typeof ORDER_STATUS_LABELS[status]).toBe("string")
    }
  })

  it("ACTIVE_STATUSES and TERMINAL_STATUSES cover all statuses", () => {
    const all = [...ACTIVE_STATUSES, ...TERMINAL_STATUSES]
    const statusValues = Object.values(ORDER_STATUS)
    for (const status of statusValues) {
      expect(all).toContain(status)
    }
  })

  it("has no overlap between ACTIVE and TERMINAL statuses", () => {
    const overlap = ACTIVE_STATUSES.filter((s) => TERMINAL_STATUSES.includes(s))
    expect(overlap).toHaveLength(0)
  })
})

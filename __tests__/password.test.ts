import { describe, it, expect } from "vitest"
import { hashPassword, verifyPassword, isHashed } from "../lib/password"

describe("password utils", () => {
  it("hashes a password", async () => {
    const hash = await hashPassword("secret123")
    expect(hash).toMatch(/^\$2[ab]\$/)
    expect(hash).not.toBe("secret123")
  })

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("myPassword")
    const result = await verifyPassword("myPassword", hash)
    expect(result).toBe(true)
  })

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct")
    const result = await verifyPassword("wrong", hash)
    expect(result).toBe(false)
  })

  it("supports legacy plaintext comparison", async () => {
    // If the stored value is not a bcrypt hash, it falls back to direct comparison
    const result = await verifyPassword("plaintext", "plaintext")
    expect(result).toBe(true)

    const wrong = await verifyPassword("different", "plaintext")
    expect(wrong).toBe(false)
  })

  it("detects hashed vs plaintext values", () => {
    expect(isHashed("$2a$10$abcdefghijklmnopqrstuvwxyz")).toBe(true)
    expect(isHashed("$2b$10$abcdefghijklmnopqrstuvwxyz")).toBe(true)
    expect(isHashed("plaintext")).toBe(false)
    expect(isHashed("")).toBe(false)
  })
})

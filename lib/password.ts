import bcrypt from "bcryptjs"

const SALT_ROUNDS = 10

/** Hash a plaintext password */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/** Compare a plaintext password against a stored hash */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** Check if a stored password value is already hashed */
export function isHashed(value: string): boolean {
  return value.startsWith("$2a$") || value.startsWith("$2b$")
}

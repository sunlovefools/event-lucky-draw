import { createHash, randomUUID } from "node:crypto";

export function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

export function newSalt(): string {
  return randomUUID();
}

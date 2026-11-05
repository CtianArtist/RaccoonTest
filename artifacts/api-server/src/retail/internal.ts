import { createHmac, randomBytes } from "node:crypto";
export const internalKey = randomBytes(32).toString("hex");
export const pythonOrigin = "http://127.0.0.1:5041";
export function signProof(method: string, path: string, identity: Record<string, unknown> = {}) {
  const raw = JSON.stringify({ time: Math.floor(Date.now() / 1000), method, path, ...identity });
  return { "x-rsc-proof": raw, "x-rsc-signature": createHmac("sha256", internalKey).update(raw).digest("hex") };
}

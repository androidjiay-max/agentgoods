/**
 * Signed access tokens — no DB storage needed.
 *
 * Token format: tok_<base64url(payload)>.<base64url(hmac)>
 *
 * Payload contains productId, transactionId, and expiration.
 * The HMAC prevents forgery. Verification is stateless.
 */

import crypto from "crypto";

function getSecret(): string {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret || secret === "change-me-in-production-use-random-64-chars") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ACCESS_TOKEN_SECRET must be set in production");
    }
    // Dev fallback — never used in production
    return "agentgoods-dev-" + (process.env.NODE_ENV ?? "development");
  }
  return secret;
}

const SECRET = getSecret();
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface TokenPayload {
  productId: string;
  transactionId: string;
  exp: number; // epoch ms
}

export function signToken(productId: string, transactionId: string): string {
  const payload: TokenPayload = {
    productId,
    transactionId,
    exp: Date.now() + TOKEN_TTL_MS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(payloadB64)
    .digest("base64url");

  return `tok_${payloadB64}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  // Strip "tok_" prefix if present
  const raw = token.startsWith("tok_") ? token.slice(4) : token;

  const dotIdx = raw.lastIndexOf(".");
  if (dotIdx === -1) return null;

  const payloadB64 = raw.slice(0, dotIdx);
  const signatureB64 = raw.slice(dotIdx + 1);

  // Compute expected signature
  const expectedSigB64 = crypto
    .createHmac("sha256", SECRET)
    .update(payloadB64)
    .digest("base64url");

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(signatureB64);
  const expBuf = Buffer.from(expectedSigB64);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  // Decode payload
  try {
    const payload: TokenPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString(),
    );

    // Check expiration
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

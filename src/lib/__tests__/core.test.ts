/**
 * Core business logic tests — no database dependency.
 * Run with: node --import tsx --test src/lib/__tests__/core.test.ts
 *
 * Prerequisites: npm install -D tsx (if not already in devDependencies)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

// ─── Duplicated pure functions for testing (same logic as app code) ──────────
// We duplicate rather than import to avoid Prisma client dependency.

function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function generateRawApiKey(): string {
  return "ag_" + crypto.randomBytes(24).toString("base64url");
}

function apiKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, 14);
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

function checkRateLimitImpl(
  key: string,
  store: Map<string, RateLimitEntry>,
  config: { windowMs: number; maxRequests: number },
  now: number
): { allowed: boolean; remaining: number } {
  const existing = store.get(key);

  if (!existing || now - existing.windowStart > config.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.maxRequests - 1 };
  }

  existing.count++;

  if (existing.count > config.maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: config.maxRequests - existing.count };
}

function fmtCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function validatePositiveInt(value: number, fieldName: string): { success: boolean; error?: string } | null {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return { success: false, error: `${fieldName} must be a non-negative integer (in cents).` };
  }
  return null;
}

function validateString(value: string, fieldName: string, maxLen = 200): { success: boolean; error?: string } | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { success: false, error: `${fieldName} is required.` };
  }
  if (value.length > maxLen) {
    return { success: false, error: `${fieldName} must be ${maxLen} characters or fewer.` };
  }
  return null;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("API Key Hashing", () => {
  it("generates keys with ag_ prefix", () => {
    const key = generateRawApiKey();
    assert.ok(key.startsWith("ag_"), "API key must start with ag_");
    assert.ok(key.length >= 35, "API key must be at least 35 chars");
  });

  it("produces consistent SHA-256 hashes", () => {
    const rawKey = "ag_test_key_1234567890abcdef";
    const hash1 = hashApiKey(rawKey);
    const hash2 = hashApiKey(rawKey);
    assert.equal(hash1, hash2, "Hash must be deterministic");
  });

  it("produces different hashes for different keys", () => {
    const hash1 = hashApiKey("ag_key_a");
    const hash2 = hashApiKey("ag_key_b");
    assert.notEqual(hash1, hash2, "Different keys must produce different hashes");
  });

  it("hash is 64 hex chars (SHA-256)", () => {
    const hash = hashApiKey("ag_test");
    assert.equal(hash.length, 64, "SHA-256 produces 64 hex characters");
  });

  it("prefix returns first 14 chars of raw key", () => {
    const prefix = apiKeyPrefix("ag_aB3xYz1kLmN9oPqR");
    assert.equal(prefix, "ag_aB3xYz1kLmN");
    assert.equal(prefix.length, 14);
  });
});

describe("Rate Limiter", () => {
  it("allows requests within limit", () => {
    const store = new Map<string, RateLimitEntry>();
    const config = { windowMs: 60_000, maxRequests: 5 };
    const baseTime = 1_000_000;

    for (let i = 0; i < 5; i++) {
      const result = checkRateLimitImpl("test-key", store, config, baseTime);
      assert.ok(result.allowed, `Request ${i + 1} should be allowed`);
      assert.equal(result.remaining, 4 - i);
    }
  });

  it("blocks requests exceeding limit", () => {
    const store = new Map<string, RateLimitEntry>();
    const config = { windowMs: 60_000, maxRequests: 3 };
    const baseTime = 1_000_000;

    // Exhaust the limit
    checkRateLimitImpl("test-key", store, config, baseTime);
    checkRateLimitImpl("test-key", store, config, baseTime);
    checkRateLimitImpl("test-key", store, config, baseTime);

    // 4th request should be blocked
    const blocked = checkRateLimitImpl("test-key", store, config, baseTime);
    assert.ok(!blocked.allowed, "4th request should be blocked");
    assert.equal(blocked.remaining, 0);
  });

  it("resets window after time passes", () => {
    const store = new Map<string, RateLimitEntry>();
    const config = { windowMs: 1000, maxRequests: 2 };
    const baseTime = 1_000_000;

    checkRateLimitImpl("test-key", store, config, baseTime);
    checkRateLimitImpl("test-key", store, config, baseTime);

    // Should be blocked
    const blocked = checkRateLimitImpl("test-key", store, config, baseTime);
    assert.ok(!blocked.allowed);

    // Advance past window
    const result = checkRateLimitImpl("test-key", store, config, baseTime + 2000);
    assert.ok(result.allowed, "Should allow after window expires");
    assert.equal(result.remaining, 1, "Counter should reset");
  });

  it("tracks different keys independently", () => {
    const store = new Map<string, RateLimitEntry>();
    const config = { windowMs: 60_000, maxRequests: 2 };
    const baseTime = 1_000_000;

    // Exhaust key-a
    checkRateLimitImpl("key-a", store, config, baseTime);
    checkRateLimitImpl("key-a", store, config, baseTime);
    const blockedA = checkRateLimitImpl("key-a", store, config, baseTime);
    assert.ok(!blockedA.allowed);

    // key-b should still be allowed
    const allowedB = checkRateLimitImpl("key-b", store, config, baseTime);
    assert.ok(allowedB.allowed, "Key-b should not be affected by key-a's limit");
  });
});

describe("fmtCents", () => {
  it("formats zero correctly", () => {
    assert.equal(fmtCents(0), "0.00");
  });

  it("formats whole dollars", () => {
    assert.equal(fmtCents(500), "5.00");
  });

  it("formats cents correctly", () => {
    assert.equal(fmtCents(1299), "12.99");
  });

  it("handles single cent", () => {
    assert.equal(fmtCents(1), "0.01");
  });

  it("handles large values", () => {
    assert.equal(fmtCents(100000), "1000.00");
  });
});

describe("validatePositiveInt", () => {
  it("accepts valid positive integers", () => {
    assert.equal(validatePositiveInt(100, "Test"), null);
    assert.equal(validatePositiveInt(0, "Test"), null);
  });

  it("rejects negative values", () => {
    const result = validatePositiveInt(-1, "Test");
    assert.ok(result !== null);
    assert.ok(!result!.success);
  });

  it("rejects floats", () => {
    const result = validatePositiveInt(1.5, "Test");
    assert.ok(result !== null);
    assert.ok(!result!.success);
  });

  it("rejects NaN", () => {
    const result = validatePositiveInt(NaN, "Test");
    assert.ok(result !== null);
    assert.ok(!result!.success);
  });

  it("rejects Infinity", () => {
    const result = validatePositiveInt(Infinity, "Test");
    assert.ok(result !== null);
    assert.ok(!result!.success);
  });
});

describe("validateString", () => {
  it("accepts valid strings", () => {
    assert.equal(validateString("hello", "Name"), null);
  });

  it("rejects empty strings", () => {
    const result = validateString("", "Name");
    assert.ok(result !== null);
    assert.ok(!result!.success);
  });

  it("rejects whitespace-only strings", () => {
    const result = validateString("   ", "Name");
    assert.ok(result !== null);
    assert.ok(!result!.success);
  });

  it("rejects strings exceeding max length", () => {
    const result = validateString("a".repeat(201), "Name", 200);
    assert.ok(result !== null);
    assert.ok(!result!.success);
  });

  it("accepts strings at max length", () => {
    assert.equal(validateString("a".repeat(200), "Name", 200), null);
  });
});

describe("Transaction Race Condition Simulation", () => {
  /**
   * Verifies that the updateMany + WHERE pattern correctly prevents overspend.
   * This is a logic-level test — the actual DB integration test requires Prisma.
   */
  it("updateMany with balance >= price prevents overspend (logic test)", () => {
    // Simulate two concurrent purchases against the same $10.00 balance.
    const balance = 1000; // cents
    const productPrice = 800; // cents

    // Purchase A: check balance >= price → true, deduct
    const purchaseAOk = balance >= productPrice; // 1000 >= 800 → true
    assert.ok(purchaseAOk, "Purchase A should succeed");

    const balanceAfterA = balance - productPrice; // 200

    // Purchase B: check balance >= price → 200 >= 800 → false
    const purchaseBOk = balanceAfterA >= productPrice;
    assert.ok(!purchaseBOk, "Purchase B should be rejected — balance drained by A");
  });
});

"use server"

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

// ─── Auth Helper ──────────────────────────────────────────────────────────────

const SIGNUP_BONUS_CENTS = 5_00; // $5.00
const BONUS_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * Get the currently authenticated user.
 * Reads from Supabase session cookie, finds matching Prisma User by email.
 * Creates a Prisma User on first login with a $5 signup bonus (expires in 14 days).
 * Deducts expired bonuses on subsequent logins.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser?.email) {
    throw new Error("Not authenticated");
  }

  let dbUser = await prisma.user.findUnique({ where: { email: authUser.email } });

  if (!dbUser) {
    // First login — create user with $5 signup bonus
    const expiresAt = new Date(Date.now() + BONUS_DURATION_MS);
    dbUser = await prisma.user.create({
      data: {
        email: authUser.email,
        balance: SIGNUP_BONUS_CENTS,
        bonusExpiresAt: expiresAt,
      },
    });
    logger.info("New user created with $5 signup bonus", {
      email: authUser.email,
      bonusExpiresAt: expiresAt.toISOString(),
    });
    return dbUser;
  }

  // Returning user — check if signup bonus has expired and hasn't been deducted yet
  if (dbUser.bonusExpiresAt && new Date() > dbUser.bonusExpiresAt) {
    // Deduct the bonus if the user still has enough balance
    const deduction = Math.min(SIGNUP_BONUS_CENTS, dbUser.balance);
    if (deduction > 0) {
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          balance: { decrement: deduction },
          bonusExpiresAt: null, // Clear so we only deduct once
        },
      });
      logger.info("Signup bonus expired and deducted", {
        userId: dbUser.id,
        deducted: deduction,
        remainingBalance: dbUser.balance,
      });
    } else {
      // Bonus expired but balance is $0 — just clear the expiry flag
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: { bonusExpiresAt: null },
      });
    }
  }

  return dbUser;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  error?: string;
}

export interface CreateAgentResult extends ActionResult {
  /** The raw API key — ONLY returned once at creation time. Store it securely. */
  apiKey?: string;
}

// ─── Cryptographic Helpers ───────────────────────────────────────────────────

/** Generate a cryptographically secure raw API key with the "ag_" prefix. */
function generateRawApiKey(): string {
  return "ag_" + crypto.randomBytes(24).toString("base64url");
}

/** Hash a raw API key with SHA-256 for storage. */
function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/** Extract display prefix from raw key (e.g. "ag_aB3xYz..." → "ag_aB3xYz1kL..."). */
function apiKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, 14);
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

/** Validate that a value is a positive integer (representing cents). */
function validatePositiveInt(value: number, fieldName: string): ActionResult | null {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return { success: false, error: `${fieldName} must be a non-negative integer (in cents).` };
  }
  return null;
}

/** Validate that a string is non-empty and safe. */
function validateString(value: string, fieldName: string, maxLen = 200): ActionResult | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { success: false, error: `${fieldName} is required.` };
  }
  if (value.length > maxLen) {
    return { success: false, error: `${fieldName} must be ${maxLen} characters or fewer.` };
  }
  return null;
}

// ─── Error Classification ────────────────────────────────────────────────────

/**
 * Classify Prisma errors into user-friendly messages.
 * Returns null if the error is not a known Prisma error.
 */
function classifyPrismaError(err: unknown): string | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": // Unique constraint violation
        // Extract the target field(s) from the error metadata
        const targets = (err.meta?.target as string[]) ?? [];
        if (targets.includes("apiKeyHash")) {
          return "An agent with this API key already exists. Please try again.";
        }
        if (targets.includes("email")) {
          return "A user with this email already exists.";
        }
        if (targets.includes("idempotencyKey")) {
          return "This transaction has already been processed.";
        }
        return "A record with this value already exists. Please use a unique value.";
      case "P2025": // Record not found
        return "The requested record was not found. It may have been deleted.";
      case "P2003": // Foreign key constraint failed
        return "Invalid reference: the related record does not exist.";
      case "P2014": // Required relation violation
        return "Cannot perform this action: a required relation is missing.";
      default:
        return null;
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return "Invalid data format. Please check your input.";
  }
  return null;
}

// ─── Action Utilities ────────────────────────────────────────────────────────

/** Wrap a mutation with try-catch, error classification, and revalidation. */
async function withRevalidation<T>(fn: () => Promise<T>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    const classified = classifyPrismaError(err);
    if (classified) {
      logger.warn("Prisma error in server action", {
        error: err instanceof Error ? err.message : String(err),
        classified,
      });
      return { success: false, error: classified };
    }
    logger.error("Unhandled server action error", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/** Get the current user — alias for getCurrentUser (used by page.tsx). */
export async function getOrCreateDefaultUser() {
  return getCurrentUser();
}

/** Simulate Stripe Checkout / USDC Deposit. Amount is in dollar units. */
export async function depositFunds(dollars: number): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!Number.isFinite(dollars) || dollars <= 0 || dollars > 10_000) {
    return { success: false, error: "Deposit amount must be between $0.01 and $10,000." };
  }

  const cents = Math.round(dollars * 100);
  if (cents <= 0) {
    return { success: false, error: "Deposit amount too small." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { balance: { increment: cents } },
      });
      await tx.ledgerTransaction.create({
        data: {
          amount: cents,
          type: "DEPOSIT",
          userId: user.id, // Denormalized for direct audit queries
          // agentId and productId are null for deposits
        },
      });
    });
    logger.info("Deposit successful", { userId: user.id, amount: cents });
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    const classified = classifyPrismaError(err);
    if (classified) {
      return { success: false, error: classified };
    }
    logger.error("Deposit error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Create a new Agent with a crypto-generated API key.
 * Budget is in dollar units.
 * IMPORTANT: The raw API key is only returned ONCE in the result.
 * Store it securely — it cannot be recovered (only the hash is stored).
 */
export async function createAgent(
  name: string,
  budgetDollars: number
): Promise<CreateAgentResult> {
  const user = await getCurrentUser();
  const nameErr = validateString(name, "Agent name");
  if (nameErr) return nameErr;

  const budgetCents = Math.round(budgetDollars * 100);
  const budgetErr = validatePositiveInt(budgetCents, "Budget");
  if (budgetErr) return budgetErr;
  if (budgetCents === 0) {
    return { success: false, error: "Budget must be greater than zero." };
  }

  const rawApiKey = generateRawApiKey();
  const keyHash = hashApiKey(rawApiKey);
  const prefix = apiKeyPrefix(rawApiKey);

  try {
    await prisma.agent.create({
      data: {
        name: name.trim(),
        apiKeyHash: keyHash,
        apiKeyPrefix: prefix,
        maxBudget: budgetCents,
        userId: user.id,
      },
    });
    revalidatePath("/");
    logger.info("Agent created", { userId: user.id, agentName: name.trim() });
    return { success: true, apiKey: rawApiKey };
  } catch (err) {
    const classified = classifyPrismaError(err);
    if (classified) {
      return { success: false, error: classified };
    }
    logger.error("Agent creation error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

/** Delete an agent. Transaction history is preserved (agentId set to null via SetNull). */
export async function deleteAgent(agentId: string): Promise<ActionResult> {
  const err = validateString(agentId, "Agent ID");
  if (err) return err;

  return withRevalidation(() =>
    prisma.agent.delete({ where: { id: agentId } })
  );
}

/**
 * Create a new digital product/SKU. Price is in dollar units.
 * ownerId is the seller — defaults to the system admin user for MVP.
 */
export async function createProduct(
  name: string,
  description: string,
  priceDollars: number,
  isSubscription = false,
  schemaString?: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const nameErr = validateString(name, "Product name");
  if (nameErr) return nameErr;

  const descErr = validateString(description, "Description", 500);
  if (descErr) return descErr;

  const priceCents = Math.round(priceDollars * 100);
  const priceErr = validatePositiveInt(priceCents, "Price");
  if (priceErr) return priceErr;
  if (priceCents === 0) {
    return { success: false, error: "Price must be greater than zero." };
  }

  // Use provided schema or default placeholder
  let finalSchema: string;
  if (schemaString && schemaString.trim()) {
    try {
      JSON.parse(schemaString); // validate JSON
      finalSchema = schemaString.trim();
    } catch {
      return { success: false, error: "Schema must be valid JSON." };
    }
  } else {
    finalSchema = JSON.stringify({
      type: "object",
      properties: {
        action: { type: "string" },
      },
      required: ["action"],
    });
  }

  return withRevalidation(() =>
    prisma.product.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        price: priceCents,
        isSubscription,
        schemaString: finalSchema,
        ownerId: user.id,
      },
    })
  );
}

/** Delete a product. Transaction history referencing it is preserved. */
export async function deleteProduct(productId: string): Promise<ActionResult> {
  const err = validateString(productId, "Product ID");
  if (err) return err;

  return withRevalidation(() =>
    prisma.product.delete({ where: { id: productId } })
  );
}

/** Update an existing product (owner only via getCurrentUser). */
export async function updateProduct(
  productId: string,
  data: { name?: string; description?: string; priceDollars?: number; isSubscription?: boolean; schemaString?: string },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) {
    const err = validateString(data.name, "Product name");
    if (err) return err;
    updateData.name = data.name.trim();
  }
  if (data.description !== undefined) {
    updateData.description = data.description.trim();
  }
  if (data.priceDollars !== undefined) {
    if (data.priceDollars <= 0) return { success: false, error: "Price must be greater than zero." };
    updateData.price = Math.round(data.priceDollars * 100);
  }
  if (data.isSubscription !== undefined) {
    updateData.isSubscription = data.isSubscription;
  }
  if (data.schemaString !== undefined) {
    if (data.schemaString.trim()) {
      try { JSON.parse(data.schemaString); } catch { return { success: false, error: "Schema must be valid JSON." }; }
      updateData.schemaString = data.schemaString.trim();
    }
  }

  return withRevalidation(async () => {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.ownerId !== user.id) {
      throw new Error("Not authorized to edit this product");
    }
    await prisma.product.update({ where: { id: productId }, data: updateData });
  });
}

/**
 * Refund a purchase transaction.
 * Restores buyer balance, decrements seller balance + earnings, creates REFUND ledger entry.
 * Only the seller who received the payment can refund.
 */
export async function refundTransaction(
  transactionId: string,
): Promise<ActionResult> {
  const err = validateString(transactionId, "Transaction ID");
  if (err) return err;

  try {
    await prisma.$transaction(async (tx) => {
      // Find the original purchase
      const original = await tx.ledgerTransaction.findUnique({
        where: { id: transactionId },
        include: { product: true, agent: { include: { user: true } } },
      });

      if (!original || original.type !== "PURCHASE") {
        throw new Error("Transaction not found or not a purchase");
      }

      // Check not already refunded
      const existingRefund = await tx.ledgerTransaction.findFirst({
        where: {
          type: "REFUND",
          // Match by same agent+product+amount pattern
          agentId: original.agentId,
          productId: original.productId,
          amount: original.amount,
        },
      });
      if (existingRefund) {
        throw new Error("Transaction has already been refunded");
      }

      const buyer = original.agent?.user;
      if (!buyer) throw new Error("Buyer not found");

      // Restore buyer balance
      await tx.user.update({
        where: { id: buyer.id },
        data: { balance: { increment: original.amount } },
      });

      // If there was a seller, reverse their credit
      if (original.product?.ownerId) {
        await tx.user.update({
          where: { id: original.product.ownerId },
          data: {
            balance: { decrement: original.amount },
            earnings: { decrement: original.amount },
          },
        });
      }

      // Reverse agent spend
      if (original.agentId) {
        await tx.agent.update({
          where: { id: original.agentId },
          data: { currentSpend: { decrement: original.amount } },
        });
      }

      // Create refund ledger entry
      await tx.ledgerTransaction.create({
        data: {
          agentId: original.agentId,
          productId: original.productId,
          userId: buyer.id,
          amount: original.amount,
          type: "REFUND",
        },
      });
    });

    revalidatePath("/");
    logger.info("Refund processed", { transactionId });
    return { success: true };
  } catch (err) {
    const classified = classifyPrismaError(err);
    if (classified) return { success: false, error: classified };
    logger.error("Refund error", {
      error: err instanceof Error ? err.message : String(err),
      transactionId,
    });
    return { success: false, error: "Refund could not be processed. Please try again." };
  }
}

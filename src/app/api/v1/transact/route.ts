import { NextResponse } from "next/server";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { checkRateLimit, TRANSACT_CONFIG } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { apiError, ErrorCode, requestId } from "@/lib/api-error";
import { signToken } from "@/lib/access-token";
import type { ErrorCodeType } from "@/lib/api-error";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

// ─── Transaction result type ─────────────────────────────────────────────────

type TxResult =
  | { ok: true; transactionId: string; productId: string }
  | { ok: false; code: ErrorCodeType; status: number; logMsg: string; details?: unknown }
  | { idempotent: true; transactionId: string };

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const rid = requestId();

  try {
    // 0. Rate limit
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const rl = checkRateLimit(`transact:${ip}`, TRANSACT_CONFIG);
    if (!rl.allowed) {
      logger.warn("Rate limited", { ip, requestId: rid });
      return apiError(
        429, ErrorCode.RATE_LIMITED,
        "Too many requests. Retry after the window resets.",
        { retryAfterMs: rl.resetMs, requestId: rid },
      );
    }

    // 1. Authenticate
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return apiError(
        401, ErrorCode.AUTH_MISSING,
        "Missing Authorization header. Provide a Bearer token with your Agent API key.",
        { requestId: rid },
      );
    }

    const rawApiKey = authHeader.slice(7);
    if (rawApiKey.length < 10) {
      return apiError(
        401, ErrorCode.AUTH_INVALID_KEY,
        "API key is too short to be valid.",
        { requestId: rid },
      );
    }
    const apiKeyHash = hashApiKey(rawApiKey);

    // 2. Parse body
    let body: { productId?: string; idempotencyKey?: string };
    try {
      body = await req.json();
    } catch {
      return apiError(
        400, ErrorCode.INVALID_JSON,
        "Request body is not valid JSON.",
        { requestId: rid },
      );
    }

    const { productId, idempotencyKey } = body;

    if (!productId || typeof productId !== "string") {
      return apiError(
        400, ErrorCode.MISSING_FIELD,
        "Missing required field: productId.",
        { field: "productId", requestId: rid },
      );
    }

    // 3. Atomic transaction — all checks and writes in one DB transaction
    const result: TxResult = await prisma.$transaction(async (tx) => {
      // 3a. Look up agent FIRST (so idempotency can be scoped per-agent)
      const agent = await tx.agent.findUnique({
        where: { apiKeyHash },
        include: { user: true },
      });

      if (!agent) {
        return {
          ok: false, code: ErrorCode.AUTH_INVALID_KEY, status: 401,
          logMsg: "Unknown API key",
        };
      }

      // 3b. Idempotency check — scoped: same key + same agent = idempotent replay
      //      Different agent with same key = collision (rejected)
      if (idempotencyKey) {
        const existing = await tx.ledgerTransaction.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          if (existing.agentId === agent.id && existing.productId === productId) {
            // Same agent, same product — safe idempotent replay
            return { idempotent: true as const, transactionId: existing.id };
          }
          // Different agent or different product — reject the collision
          return {
            ok: false, code: ErrorCode.SELF_PURCHASE, status: 409,
            logMsg: `Idempotency key collision: agent ${agent.id} vs existing agent ${existing.agentId}`,
            details: { idempotencyKey, existingTransactionId: existing.id },
          };
        }
      }

      // 3c. Look up product
      const product = await tx.product.findUnique({ where: { id: productId } });

      if (!product?.isAvailable) {
        return {
          ok: false, code: ErrorCode.PRODUCT_NOT_FOUND, status: 404,
          logMsg: `Product ${productId} not found or unavailable`,
          details: { productId },
        };
      }

      // 3d. Self-purchase guard — buying your own product is not allowed
      if (product.ownerId === agent.userId) {
        return {
          ok: false, code: ErrorCode.SELF_PURCHASE, status: 400,
          logMsg: `Agent ${agent.id} cannot purchase own product ${product.id}`,
          details: { productId, agentId: agent.id },
        };
      }

      // 3e. Budget check
      if (agent.currentSpend + product.price > agent.maxBudget) {
        return {
          ok: false, code: ErrorCode.BUDGET_EXCEEDED, status: 403,
          logMsg: `Agent ${agent.id} budget would be exceeded`,
          details: {
            currentSpend: agent.currentSpend,
            maxBudget: agent.maxBudget,
            productPrice: product.price,
            shortfall: product.price - (agent.maxBudget - agent.currentSpend),
          },
        };
      }

      // 3f. Balance deduction — atomic with WHERE guard
      const balanceUpdate = await tx.user.updateMany({
        where: { id: agent.userId, balance: { gte: product.price } },
        data: { balance: { decrement: product.price } },
      });

      if (balanceUpdate.count === 0) {
        const buyer = await tx.user.findUnique({ where: { id: agent.userId } });
        return {
          ok: false, code: ErrorCode.INSUFFICIENT_BALANCE, status: 402,
          logMsg: `User ${agent.userId} has insufficient balance`,
          details: {
            balance: buyer?.balance ?? 0,
            required: product.price,
            shortfall: product.price - (buyer?.balance ?? 0),
          },
        };
      }

      // 3g. Agent spend update — atomic with condition
      const agentUpdate = await tx.agent.updateMany({
        where: {
          id: agent.id,
          currentSpend: { lte: agent.maxBudget - product.price },
        },
        data: { currentSpend: { increment: product.price } },
      });

      if (agentUpdate.count === 0) {
        throw new Error(`Budget constraint violated mid-transaction for agent ${agent.id}`);
      }

      // 3h. Credit seller — product.ownerId is guaranteed != agent.userId from 3d
      if (product.ownerId) {
        await tx.user.update({
          where: { id: product.ownerId },
          data: {
            balance: { increment: product.price },
            earnings: { increment: product.price },
          },
        });
      }

      // 3i. Create ledger entry — P2002 on idempotencyKey handled below
      try {
        const ledgerEntry = await tx.ledgerTransaction.create({
          data: {
            agentId: agent.id,
            productId: product.id,
            userId: agent.userId,
            amount: product.price,
            type: "PURCHASE",
            idempotencyKey: idempotencyKey ?? null,
          },
        });

        return {
          ok: true as const,
          transactionId: ledgerEntry.id,
          productId: product.id,
        };
      } catch (err) {
        // P2002 = unique constraint on idempotencyKey — concurrent race, treat as idempotent
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const existing = await tx.ledgerTransaction.findUnique({
            where: { idempotencyKey: idempotencyKey! },
          });
          if (existing) {
            return { idempotent: true as const, transactionId: existing.id };
          }
        }
        throw err;
      }
    });

    // ── Handle result ──

    if ("idempotent" in result && result.idempotent) {
      logger.info("Idempotent replay", { transactionId: result.transactionId, requestId: rid });
      return NextResponse.json({
        success: true,
        data: {
          transaction_id: result.transactionId,
          message: "Transaction already processed (idempotent).",
        },
      });
    }

    if ("ok" in result && !result.ok) {
      logger.warn(result.logMsg, { code: result.code, details: result.details, requestId: rid });
      return apiError(result.status, result.code, errorMessageForCode(result.code, result.details), {
        ...((result.details as object) ?? {}),
        requestId: rid,
      });
    }

    if ("ok" in result && result.ok) {
      const baseUrl = process.env.AGENTGOODS_BASE_URL ?? "https://agentgoods.io";

      logger.info("Purchase successful", {
        transactionId: result.transactionId,
        productId: result.productId,
        requestId: rid,
      });

      return NextResponse.json({
        success: true,
        data: {
          transaction_id: result.transactionId,
          message: "Purchase successful.",
          payload: {
            api_endpoint: `${baseUrl}/services/access/${result.productId}`,
            access_token: signToken(result.productId, result.transactionId),
          },
        },
      });
    }

    return apiError(500, ErrorCode.TRANSACTION_FAILED, "Unexpected transaction state.", { requestId: rid });
  } catch (error) {
    logger.error("Unhandled error in /transact", {
      error: error instanceof Error ? error.message : String(error),
      requestId: rid,
    });
    return apiError(
      500, ErrorCode.INTERNAL_ERROR,
      "An internal error occurred. Retry with the same idempotency key.",
      { requestId: rid },
    );
  }
}

// ─── Human-readable error messages ───────────────────────────────────────────

function errorMessageForCode(code: ErrorCodeType, details?: unknown): string {
  const d = details as Record<string, unknown> | undefined;
  switch (code) {
    case ErrorCode.AUTH_INVALID_KEY:
      return "The API key is invalid. Check your Agent API key in the dashboard.";
    case ErrorCode.PRODUCT_NOT_FOUND:
      return "Product not found or is currently unavailable.";
    case ErrorCode.BUDGET_EXCEEDED:
      return `Agent budget exceeded. Current spend: $${cents(d?.currentSpend)}, budget: $${cents(d?.maxBudget)}.`;
    case ErrorCode.INSUFFICIENT_BALANCE:
      return `Insufficient wallet balance. Balance: $${cents(d?.balance)}, required: $${cents(d?.required)}.`;
    case ErrorCode.SELF_PURCHASE:
      return "Cannot purchase your own product. Use a different agent or product.";
    default:
      return "Transaction could not be processed.";
  }
}

function cents(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? (n / 100).toFixed(2) : "?.??";
}

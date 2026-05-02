import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { checkRateLimit, DEFAULT_CONFIG } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { apiError, ErrorCode, requestId } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const rid = requestId();

  // Rate limit
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const rl = checkRateLimit(`catalog:${ip}`, DEFAULT_CONFIG);
  if (!rl.allowed) {
    logger.warn("Catalog rate limited", { ip, requestId: rid });
    return apiError(
      429, ErrorCode.RATE_LIMITED,
      "Too many requests. Slow down.",
      { retryAfterMs: rl.resetMs, requestId: rid },
    );
  }

  try {
    const url = new URL(req.url);

    // Pagination params
    const limit = Math.min(
      Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)),
      MAX_LIMIT,
    );
    const cursor = url.searchParams.get("cursor") ?? undefined;

    // Optional filters
    const search = url.searchParams.get("q")?.trim();
    const maxPrice = url.searchParams.get("max_price") ? parseInt(url.searchParams.get("max_price")!, 10) : undefined;

    // Build where clause
    const where: Record<string, unknown> = { isAvailable: true };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (maxPrice !== undefined && Number.isFinite(maxPrice)) {
      where.price = { lte: maxPrice };
    }

    // Fetch products with cursor-based pagination
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1, // fetch one extra to detect hasMore
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = products.length > limit;
    if (hasMore) products.pop();

    const nextCursor = hasMore ? products[products.length - 1]?.id ?? null : null;

    // Format for LLM tool-calling
    const catalog = products.map((p) => ({
      product_id: p.id,
      name: p.name,
      description: p.description,
      price: p.price / 100,
      is_subscription: p.isSubscription,
      tool_schema: p.schemaString ? JSON.parse(p.schemaString) : null,
    }));

    return NextResponse.json(
      {
        success: true,
        data: catalog,
        pagination: {
          limit,
          has_more: hasMore,
          next_cursor: nextCursor,
          total_hint: `Use '?cursor=${nextCursor}&limit=${limit}' to fetch the next page.`,
        },
      },
      {
        headers: {
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-Request-Id": rid,
          "Cache-Control": "public, max-age=5, stale-while-revalidate=10",
        },
      },
    );
  } catch (error) {
    logger.error("Catalog fetch error", {
      error: error instanceof Error ? error.message : String(error),
      requestId: rid,
    });
    return apiError(
      500, ErrorCode.INTERNAL_ERROR,
      "Failed to fetch catalog. Retry in a moment.",
      { requestId: rid },
    );
  }
}

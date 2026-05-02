import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/access-token";
import { apiError, ErrorCode } from "@/lib/api-error";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /services/access/:productId
 *
 * The agent calls this after a successful purchase to get actual API data.
 * Authenticates via the signed access token from the purchase response.
 *
 * Body: { access_token: "tok_..." }
 * Returns: Product-specific data (real or mock depending on product config)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;

  try {
    // Parse body
    let body: { access_token?: string; params?: Record<string, unknown> };
    try {
      body = await req.json();
    } catch {
      return apiError(400, ErrorCode.INVALID_JSON, "Request body is not valid JSON.");
    }

    if (!body.access_token) {
      return apiError(400, ErrorCode.MISSING_FIELD, "Missing access_token in request body.");
    }

    // Verify token
    const payload = verifyToken(body.access_token);
    if (!payload) {
      return apiError(401, ErrorCode.AUTH_INVALID_KEY, "Access token is invalid or expired.");
    }

    if (payload.productId !== productId) {
      return apiError(403, ErrorCode.AUTH_INVALID_KEY, "Access token does not match the requested product.");
    }

    // Fetch product
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return apiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Product not found.");
    }

    // ── Generate response data ──
    // In production, this would proxy to the real upstream API using the seller's
    // stored API credentials. For MVP, we return realistic mock data based on
    // the product schema and the agent's input parameters.
    const callParams = body.params ?? {};
    const mockData = generateMockResponse(product.name, callParams);

    logger.info("Service access", {
      productId,
      transactionId: payload.transactionId,
      params: callParams,
    });

    return NextResponse.json({
      success: true,
      data: {
        product_id: productId,
        product_name: product.name,
        transaction_id: payload.transactionId,
        result: mockData,
      },
      meta: {
        accessed_at: new Date().toISOString(),
        token_expires_at: new Date(payload.exp).toISOString(),
      },
    });
  } catch (error) {
    logger.error("Service access error", {
      error: error instanceof Error ? error.message : String(error),
      productId,
    });
    return apiError(500, ErrorCode.INTERNAL_ERROR, "Failed to access the service.");
  }
}

// ─── Mock data generator ─────────────────────────────────────────────────────
// Phase 2: Replace with real API proxy callouts using seller credentials.

function generateMockResponse(productName: string, params: Record<string, unknown>): unknown {
  const name = productName.toLowerCase();

  if (name.includes("weather")) {
    const city = (params.city as string) ?? "Tokyo";
    const units = (params.units as string) === "imperial" ? "fahrenheit" : "celsius";
    return {
      city,
      temperature: units === "fahrenheit" ? 72 : 22,
      feels_like: units === "fahrenheit" ? 70 : 21,
      humidity: 65,
      conditions: "partly cloudy",
      wind_speed: units === "fahrenheit" ? 8 : 13,
      units,
      forecast: [
        { day: "Today", high: units === "fahrenheit" ? 75 : 24, low: units === "fahrenheit" ? 62 : 17 },
        { day: "Tomorrow", high: units === "fahrenheit" ? 78 : 26, low: units === "fahrenheit" ? 65 : 18 },
      ],
    };
  }

  if (name.includes("stock")) {
    const symbol = (params.symbol as string) ?? "AAPL";
    return {
      symbol: symbol.toUpperCase(),
      price: 187.32 + (Math.random() - 0.5) * 5,
      change: (Math.random() - 0.5) * 3,
      change_percent: (Math.random() - 0.5) * 2,
      volume: Math.floor(Math.random() * 50_000_000) + 10_000_000,
      currency: "USD",
      timestamp: new Date().toISOString(),
    };
  }

  if (name.includes("llm") || name.includes("gpt")) {
    const prompt = (params.prompt as string) ?? "Hello";
    return {
      model: "gpt-4o-mini-mock",
      completion: `[Mock response to: "${prompt.slice(0, 50)}${prompt.length > 50 ? "..." : ""}"] This is a simulated LLM response. In production, this would proxy to OpenAI.`,
      usage: {
        prompt_tokens: prompt.length,
        completion_tokens: 42,
        total_tokens: prompt.length + 42,
      },
    };
  }

  if (name.includes("image")) {
    const prompt = (params.prompt as string) ?? "a beautiful sunset";
    return {
      prompt,
      style: (params.style as string) ?? "realistic",
      url: "https://placehold.co/1024x1024/111/0ff?text=AI+Generated+Image",
      seed: Math.floor(Math.random() * 1_000_000),
      generated_at: new Date().toISOString(),
    };
  }

  if (name.includes("translator") || name.includes("translate")) {
    const text = (params.text as string) ?? "Hello, world!";
    const target = (params.target_lang as string) ?? "zh";
    const mockTranslations: Record<string, string> = {
      zh: "你好，世界！",
      ja: "こんにちは、世界！",
      es: "¡Hola, mundo!",
      fr: "Bonjour, le monde !",
      de: "Hallo, Welt!",
    };
    return {
      source_text: text,
      target_language: target,
      translated_text: mockTranslations[target] ?? `[Mock translation of "${text}" to ${target}]`,
      confidence: 0.95 + Math.random() * 0.04,
      detected_source_language: "en",
    };
  }

  // Generic fallback
  return {
    message: `Mock data for "${productName}"`,
    params_received: params,
    note: "This product has no specific mock handler yet.",
  };
}

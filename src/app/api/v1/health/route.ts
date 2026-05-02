import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint — used by monitoring, load balancers, and CI.
 *
 * GET /api/v1/health
 *
 * Returns 200 with DB latency if healthy, 503 if degraded.
 */
export async function GET() {
  const checks: Record<string, { status: "ok" | "degraded"; latencyMs?: number; error?: string }> = {};

  // DB connectivity check
  const dbStart = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Math.round(performance.now() - dbStart) };
  } catch (err) {
    checks.database = {
      status: "degraded",
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }

  // Aggregate status
  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const statusCode = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    },
    { status: statusCode },
  );
}

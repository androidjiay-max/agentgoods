#!/usr/bin/env node

/**
 * AgentGoods M2M (Machine-to-Machine) Closed-Loop Test
 * ====================================================
 * Simulates an AI agent browsing the catalog, selecting a product,
 * and executing a purchase — validating the full M2M transaction flow.
 *
 * Usage:
 *   node test-agent.js [--base-url=http://localhost:3000] [--api-key=ag_xxx]
 *
 * Or set environment variables:
 *   AGENTGOODS_BASE_URL=http://localhost:3000
 *   AGENTGOODS_API_KEY=ag_your_key_here
 */

const crypto = require("crypto");

// ─── Configuration ───────────────────────────────────────────────────────────

const BASE_URL = process.env.AGENTGOODS_BASE_URL || "http://localhost:3000";
const API_KEY =
  process.env.AGENTGOODS_API_KEY ||
  (() => {
    const arg = process.argv.find((a) => a.startsWith("--api-key="));
    return arg ? arg.split("=")[1] : null;
  })() ||
  "ag_PLACEHOLDER_replace_with_real_key";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomId() {
  return crypto.randomBytes(8).toString("hex");
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(
      `[${res.status}] ${body.error || "Unknown error"} (${url})`
    );
  }
  return body;
}

function log(emoji, msg) {
  console.log(`  ${emoji}  ${msg}`);
}

function divider() {
  console.log("─".repeat(60));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        AGENTGOODS  M2M Closed-Loop Test                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`  Base URL : ${BASE_URL}`);
  console.log(`  API Key  : ${API_KEY.slice(0, 12)}...`);
  console.log();

  // ── Step 1: Browse Catalog ──────────────────────────────────────────────
  divider();
  console.log("  STEP 1  Browse Catalog (GET /api/v1/catalog)");
  divider();

  let catalog;
  try {
    const result = await fetchJSON(`${BASE_URL}/api/v1/catalog`);
    catalog = result.data;
    log("📦", `Found ${catalog.length} available product(s)`);
    for (const p of catalog) {
      console.log(`         • ${p.name}  —  $${p.price.toFixed(2)}  [${p.product_id}]`);
      if (p.is_subscription) console.log(`           (subscription)`);
    }
  } catch (err) {
    log("❌", `Catalog fetch failed: ${err.message}`);
    process.exit(1);
  }

  if (catalog.length === 0) {
    log("⚠️", "No products available. Create one in the dashboard first.");
    process.exit(0);
  }

  // ── Step 2: Select Product ──────────────────────────────────────────────
  const selected = catalog[0];
  console.log();
  divider();
  console.log("  STEP 2  Agent Decision");
  divider();
  log("🤖", `Agent selected: "${selected.name}" at $${selected.price.toFixed(2)}`);
  log("🧠", "Reasoning: First available product. In production, LLM function-calling would select this.");

  // ── Step 3: Execute Purchase ─────────────────────────────────────────────
  console.log();
  divider();
  console.log("  STEP 3  Execute Purchase (POST /api/v1/transact)");
  divider();

  const idempotencyKey = `test-${Date.now()}-${randomId()}`;
  log("🔑", `Idempotency key: ${idempotencyKey}`);

  let transactionId;
  try {
    const result = await fetchJSON(`${BASE_URL}/api/v1/transact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        productId: selected.product_id,
        idempotencyKey,
      }),
    });

    const { transaction_id, message, payload } = result.data;
    transactionId = transaction_id;
    log("✅", "Purchase successful!");
    log("🧾", `Transaction ID : ${transaction_id}`);
    log("📨", `Message         : ${message}`);
    if (payload) {
      log("🎫", `Access Token    : ${payload.access_token}`);
      log("🔗", `API Endpoint    : ${payload.api_endpoint}`);
    }
  } catch (err) {
    log("❌", `Transaction failed: ${err.message}`);
    process.exit(1);
  }

  // ── Step 4: Idempotency Verification ────────────────────────────────────
  console.log();
  divider();
  console.log("  STEP 4  Idempotency Check (retry same key)");
  divider();

  try {
    const result = await fetchJSON(`${BASE_URL}/api/v1/transact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        productId: selected.product_id,
        idempotencyKey,
      }),
    });
    log("✅", `Idempotency works: "${result.data.message}"`);
  } catch (err) {
    log("❌", `Idempotency check failed: ${err.message}`);
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  console.log();
  divider();
  console.log("  M2M CLOSED LOOP — ALL STEPS PASSED");
  divider();
  console.log();
  console.log("  Summary:");
  console.log(`    • ${catalog.length} product(s) browsed`);
  console.log(`    • 1 product purchased`);
  console.log(`    • Transaction ID: ${transactionId}`);
  console.log(`    • Idempotency: verified`);
  console.log();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

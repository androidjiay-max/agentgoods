/**
 * Seed script — populates a fresh database with demo data.
 *
 * Run: npx tsx prisma/seed.ts
 * Or:  npm run seed
 *
 * Creates:
 *   - 1 default admin user with $500 balance
 *   - 2 demo agents (Shopping Bot, Data Miner) with API keys
 *   - 5 products (3 official AgentGoods APIs + 2 user-listed)
 *   - Sample transactions for realistic dashboard appearance
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

async function main() {
  console.log("Seeding AgentGoods database…\n");

  // Clean slate
  await prisma.ledgerTransaction.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // ── User ──
  const user = await prisma.user.create({
    data: {
      email: "admin@agentgoods.io",
      balance: 500_00, // $500.00
      earnings: 0,
    },
  });
  console.log(`  User: ${user.email} (balance: $${(user.balance / 100).toFixed(2)})`);

  // ── Agents ──
  const rawKey1 = "ag_demo_shopping_bot_key_001";
  const rawKey2 = "ag_demo_data_miner_key_002";

  const agent1 = await prisma.agent.create({
    data: {
      name: "Shopping Bot",
      apiKeyHash: hashApiKey(rawKey1),
      apiKeyPrefix: rawKey1.slice(0, 14),
      maxBudget: 50_00, // $50.00
      currentSpend: 12_50, // $12.50 (some usage)
      userId: user.id,
    },
  });

  const agent2 = await prisma.agent.create({
    data: {
      name: "Data Miner",
      apiKeyHash: hashApiKey(rawKey2),
      apiKeyPrefix: rawKey2.slice(0, 14),
      maxBudget: 200_00, // $200.00
      currentSpend: 0,
      userId: user.id,
    },
  });
  console.log(`  Agents: ${agent1.name}, ${agent2.name}`);

  // ── Products (3 official + 2 user-listed) ──
  const weatherApi = await prisma.product.create({
    data: {
      name: "Weather API",
      description: "Real-time weather data for any city worldwide. Current conditions, forecasts, and alerts.",
      price: 50, // $0.50
      isSubscription: false,
      isAvailable: true,
      schemaString: JSON.stringify({
        type: "object",
        properties: {
          city: { type: "string", description: "City name, e.g. 'Tokyo'" },
          units: { type: "string", enum: ["metric", "imperial"], description: "Temperature unit" },
        },
        required: ["city"],
      }),
      ownerId: null, // Official
    },
  });

  const stockApi = await prisma.product.create({
    data: {
      name: "Stock Price API",
      description: "Live stock quotes, historical data, and market indices. 15-minute delayed for free tier.",
      price: 200, // $2.00
      isSubscription: false,
      isAvailable: true,
      schemaString: JSON.stringify({
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock ticker, e.g. 'AAPL'" },
          range: { type: "string", enum: ["1d", "5d", "1m", "1y"], description: "Time range" },
        },
        required: ["symbol"],
      }),
      ownerId: null, // Official
    },
  });

  const llmApi = await prisma.product.create({
    data: {
      name: "LLM Inference (GPT-4o Mini)",
      description: "Cheap, fast LLM completion. $0.15 per 1M input tokens. Suitable for classification and summarization.",
      price: 15, // $0.15
      isSubscription: false,
      isAvailable: true,
      schemaString: JSON.stringify({
        type: "object",
        properties: {
          prompt: { type: "string", description: "The input prompt" },
          max_tokens: { type: "integer", description: "Max tokens in response" },
        },
        required: ["prompt"],
      }),
      ownerId: null, // Official
    },
  });

  const imageGenApi = await prisma.product.create({
    data: {
      name: "Image Generator (Stable Diffusion)",
      description: "Generate high-quality images from text prompts. Resolution up to 1024x1024.",
      price: 300, // $3.00
      isSubscription: false,
      isAvailable: true,
      schemaString: JSON.stringify({
        type: "object",
        properties: {
          prompt: { type: "string", description: "Image description" },
          style: { type: "string", enum: ["realistic", "anime", "oil-painting"], description: "Art style" },
        },
        required: ["prompt"],
      }),
      ownerId: user.id, // User-listed
    },
  });

  const translatorApi = await prisma.product.create({
    data: {
      name: "Translator Plus",
      description: "Neural machine translation. 100+ language pairs. Context-aware translations.",
      price: 100, // $1.00
      isSubscription: true,
      isAvailable: true,
      schemaString: JSON.stringify({
        type: "object",
        properties: {
          text: { type: "string", description: "Text to translate" },
          target_lang: { type: "string", description: "Target language code, e.g. 'zh'" },
        },
        required: ["text", "target_lang"],
      }),
      ownerId: user.id, // User-listed
    },
  });
  console.log(`  Products: 3 official, 2 user-listed`);

  // ── Transactions ──
  await prisma.ledgerTransaction.createMany({
    data: [
      // Deposit
      { amount: 500_00, type: "DEPOSIT", userId: user.id },
      // Shopping Bot purchases
      { agentId: agent1.id, productId: weatherApi.id, userId: user.id, amount: 50, type: "PURCHASE", idempotencyKey: "seed-ik-001" },
      { agentId: agent1.id, productId: stockApi.id, userId: user.id, amount: 200, type: "PURCHASE", idempotencyKey: "seed-ik-002" },
      { agentId: agent1.id, productId: llmApi.id, userId: user.id, amount: 15, type: "PURCHASE", idempotencyKey: "seed-ik-003" },
      { agentId: agent1.id, productId: weatherApi.id, userId: user.id, amount: 50, type: "PURCHASE", idempotencyKey: "seed-ik-004" },
      { agentId: agent1.id, productId: imageGenApi.id, userId: user.id, amount: 300, type: "PURCHASE", idempotencyKey: "seed-ik-005" },
      { agentId: agent1.id, productId: llmApi.id, userId: user.id, amount: 15, type: "PURCHASE", idempotencyKey: "seed-ik-006" },
      { agentId: agent1.id, productId: translatorApi.id, userId: user.id, amount: 100, type: "PURCHASE", idempotencyKey: "seed-ik-007" },
    ],
  });
  console.log(`  Transactions: 1 deposit + 7 purchases`);

  // ── API Key reference ──
  console.log("\n  ─── Demo API Keys (save these) ───");
  console.log(`  ${agent1.name}:  ${rawKey1}`);
  console.log(`  ${agent2.name}:  ${rawKey2}`);
  console.log("\n  Seed complete. Run 'npm run dev' to start.\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Seed failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });

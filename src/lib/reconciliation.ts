/**
 * Financial Reconciliation Utility
 * ================================
 * Verifies that the denormalized balance/spend fields match the sum of ledger entries.
 * Run periodically (daily via cron, or after any incident) to detect inconsistencies.
 *
 * Usage (after prisma generate):
 *   npx tsx src/lib/reconciliation.ts
 *
 * Phase 2: Schedule this as a cron job on Vercel Cron Jobs.
 */

import prisma from "@/lib/db";
import { logger } from "@/lib/logger";

interface ReconciliationResult {
  entityType: "User" | "Agent";
  entityId: string;
  field: string;
  storedValue: number;
  computedValue: number;
  drift: number; // storedValue - computedValue (0 = healthy)
}

async function reconcileUserBalance(userId: string): Promise<ReconciliationResult | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  // Sum all ledger entries for this user
  const aggregate = await prisma.ledgerTransaction.aggregate({
    where: { userId },
    _sum: {
      amount: true,
    },
    // We need conditional summing:
    // balance = SUM(DEPOSIT amount) - SUM(PURCHASE amount) + SUM(REFUND amount)
    // But Prisma aggregate can't do conditional sums easily, so we do 3 queries
  });

  // Deposits increase balance
  const deposits = await prisma.ledgerTransaction.aggregate({
    where: { userId, type: "DEPOSIT" },
    _sum: { amount: true },
  });

  // Purchases decrease balance
  const purchases = await prisma.ledgerTransaction.aggregate({
    where: { userId, type: "PURCHASE" },
    _sum: { amount: true },
  });

  // Refunds increase balance
  const refunds = await prisma.ledgerTransaction.aggregate({
    where: { userId, type: "REFUND" },
    _sum: { amount: true },
  });

  const computedBalance =
    (deposits._sum.amount ?? 0) -
    (purchases._sum.amount ?? 0) +
    (refunds._sum.amount ?? 0);

  const drift = user.balance - computedBalance;

  return {
    entityType: "User",
    entityId: userId,
    field: "balance",
    storedValue: user.balance,
    computedValue: computedBalance,
    drift,
  };
}

async function reconcileAgentSpend(agentId: string): Promise<ReconciliationResult | null> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return null;

  const purchases = await prisma.ledgerTransaction.aggregate({
    where: { agentId, type: "PURCHASE" },
    _sum: { amount: true },
  });

  const computedSpend = purchases._sum.amount ?? 0;
  const drift = agent.currentSpend - computedSpend;

  return {
    entityType: "Agent",
    entityId: agentId,
    field: "currentSpend",
    storedValue: agent.currentSpend,
    computedValue: computedSpend,
    drift,
  };
}

async function main() {
  logger.info("Starting financial reconciliation...");

  const results: ReconciliationResult[] = [];

  // Reconcile all users
  const users = await prisma.user.findMany({ take: 10_000 });
  for (const user of users) {
    const result = await reconcileUserBalance(user.id);
    if (result && result.drift !== 0) {
      results.push(result);
      logger.warn(`Drift detected: User ${user.id} balance off by ${result.drift} cents`, {
        stored: result.storedValue,
        computed: result.computedValue,
      });
    }
  }

  // Reconcile all agents
  const agents = await prisma.agent.findMany({ take: 10_000 });
  for (const agent of agents) {
    const result = await reconcileAgentSpend(agent.id);
    if (result && result.drift !== 0) {
      results.push(result);
      logger.warn(`Drift detected: Agent ${agent.id} spend off by ${result.drift} cents`, {
        stored: result.storedValue,
        computed: result.computedValue,
      });
    }
  }

  // Report
  if (results.length === 0) {
    logger.info("Reconciliation complete — all balances are consistent.");
    console.log("\n  All balances match ledger entries. No drift detected.\n");
  } else {
    logger.error(`Reconciliation found ${results.length} discrepancies!`, {
      discrepancies: results,
    });
    console.log(`\n  WARNING: ${results.length} discrepancies found!\n`);
    for (const r of results) {
      console.log(`  ${r.entityType} ${r.entityId}: ${r.field} drift = ${r.drift} cents`);
      console.log(`    Stored: ${r.storedValue} | Computed: ${r.computedValue}\n`);
    }
  }

  // Also: check for ledger entries with null userId (pre-migration data)
  const orphanEntries = await prisma.ledgerTransaction.count({
    where: { userId: null },
  });
  if (orphanEntries > 0) {
    logger.warn(`Found ${orphanEntries} ledger entries with null userId`, { count: orphanEntries });
    console.log(`  NOTE: ${orphanEntries} ledger entries have null userId (pre-migration data).\n`);
  }

  // ── Earnings reconciliation ──
  console.log("  Checking earnings...");
  const earningsDrifts = await reconcileAllEarnings();
  results.push(...earningsDrifts);

  // ── Cross-user money conservation ──
  console.log("  Checking global money conservation...");
  await checkGlobalInvariant();
}

// ── Earnings reconciliation ──────────────────────────────────────────────────

async function reconcileAllEarnings(): Promise<ReconciliationResult[]> {
  const results: ReconciliationResult[] = [];
  const users = await prisma.user.findMany({ take: 10_000 });

  for (const user of users) {
    // Earnings = sum of PURCHASE amounts where this user was the seller
    const salesAgg = await prisma.ledgerTransaction.aggregate({
      where: {
        type: "PURCHASE",
        product: { ownerId: user.id },
      },
      _sum: { amount: true },
    });

    // Subtract refunds where this user was the seller
    const refundAgg = await prisma.ledgerTransaction.aggregate({
      where: {
        type: "REFUND",
        product: { ownerId: user.id },
      },
      _sum: { amount: true },
    });

    const computedEarnings = (salesAgg._sum.amount ?? 0) - (refundAgg._sum.amount ?? 0);
    const drift = user.earnings - computedEarnings;

    if (drift !== 0) {
      results.push({
        entityType: "User",
        entityId: user.id,
        field: "earnings",
        storedValue: user.earnings,
        computedValue: computedEarnings,
        drift,
      });
    }
  }

  return results;
}

// ── Global money conservation ───────────────────────────────────────────────

async function checkGlobalInvariant() {
  // Sum of all user balances
  const balanceSum = await prisma.user.aggregate({ _sum: { balance: true } });

  // Total deposits (money created)
  const deposits = await prisma.ledgerTransaction.aggregate({
    where: { type: "DEPOSIT" },
    _sum: { amount: true },
  });

  // Total refunds (money re-created for buyers, removed from sellers)
  const refunds = await prisma.ledgerTransaction.aggregate({
    where: { type: "REFUND" },
    _sum: { amount: true },
  });

  // Purchases of official products (money removed from system)
  const officialPurchases = await prisma.ledgerTransaction.aggregate({
    where: { type: "PURCHASE", product: { ownerId: null } },
    _sum: { amount: true },
  });

  const totalBalance = balanceSum._sum.balance ?? 0;
  const totalDeposits = deposits._sum.amount ?? 0;
  const totalRefunds = refunds._sum.amount ?? 0;
  const totalOfficialPurchases = officialPurchases._sum.amount ?? 0;

  // Invariant: SUM(balances) + SUM(official purchases) == SUM(deposits)
  // (Purchases between users are zero-sum, refunds are zero-sum)
  const expectedBalance = totalDeposits - totalOfficialPurchases;
  const drift = totalBalance - expectedBalance;

  if (drift !== 0) {
    logger.error(`Global invariant violated! Drift: ${drift} cents`, {
      totalBalance,
      totalDeposits,
      totalOfficialPurchases,
      expectedBalance,
      totalRefunds,
    });
    console.log(`\n  CRITICAL: Global money conservation violated!`);
    console.log(`    Total balances  : ${totalBalance} cents`);
    console.log(`    Total deposits  : ${totalDeposits} cents`);
    console.log(`    Official purchases: ${totalOfficialPurchases} cents`);
    console.log(`    Expected balance: ${expectedBalance} cents`);
    console.log(`    Drift           : ${drift} cents\n`);
  } else {
    logger.info("Global invariant holds — money is conserved.");
    console.log(`\n  Global invariant OK: $${(totalBalance / 100).toFixed(2)} balances == $${(expectedBalance / 100).toFixed(2)} expected.\n`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("Reconciliation failed:", err);
    prisma.$disconnect();
    process.exit(1);
  });

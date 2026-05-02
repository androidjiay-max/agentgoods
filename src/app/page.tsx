import { getOrCreateDefaultUser } from "./actions";
import prisma from "@/lib/db";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export function fmtCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Aggregate purchase stats per product from the ledger. */
async function getProductStats() {
  const rows = await prisma.ledgerTransaction.groupBy({
    by: ["productId"],
    where: { type: "PURCHASE", productId: { not: null } },
    _count: { id: true },
    _sum: { amount: true },
  });

  const map: Record<string, { purchases: number; revenue: number }> = {};
  for (const row of rows) {
    if (row.productId) {
      map[row.productId] = {
        purchases: row._count.id,
        revenue: row._sum.amount ?? 0,
      };
    }
  }
  return map;
}

export default async function Page() {
  const user = await getOrCreateDefaultUser();

  // ── Buyer data ──
  const agents = await prisma.agent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // ── Seller data ──
  const myProducts = await prisma.product.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // ── Catalog (all available products, for both discovery & display) ──
  const allProducts = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });

  // ── Ledger ──
  const transactions = await prisma.ledgerTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { agent: true, product: true },
  });

  // Buyer's own transactions
  const buyerTransactions = await prisma.ledgerTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { agent: true, product: true },
  });

  // ── Stats ──
  const productStats = await getProductStats();

  // Platform revenue: purchases where product has NO owner (official AgentGoods products)
  const platformRevenueResult = await prisma.ledgerTransaction.aggregate({
    where: {
      type: "PURCHASE",
      product: { ownerId: null },
    },
    _sum: { amount: true },
  });

  return (
    <main className="min-h-screen bg-dark-bg text-white selection:bg-neon-blue selection:text-black">
      <DashboardClient
        user={user}
        agents={agents}
        myProducts={myProducts}
        allProducts={allProducts}
        transactions={transactions}
        buyerTransactions={buyerTransactions}
        productStats={productStats}
        platformRevenue={platformRevenueResult._sum.amount ?? 0}
      />
    </main>
  );
}

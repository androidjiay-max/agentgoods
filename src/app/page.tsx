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

  // Parallelize all independent queries (6 sequential → 1 batch)
  const [
    agents,
    myProducts,
    allProducts,
    transactions,
    buyerTransactions,
    productStats,
    platformRevenueResult,
  ] = await Promise.all([
    prisma.agent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.ledgerTransaction.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { agent: true, product: true } }),
    prisma.ledgerTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { agent: true, product: true } }),
    getProductStats(),
    prisma.ledgerTransaction.aggregate({ where: { type: "PURCHASE", product: { ownerId: null } }, _sum: { amount: true } }),
  ]);

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

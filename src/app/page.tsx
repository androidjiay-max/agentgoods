import { getOrCreateDefaultUser } from "./actions";
import prisma from "@/lib/db";
import DashboardClient from "./DashboardClient";

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getOrCreateDefaultUser();
  
  const agents = await prisma.agent.findMany({ where: { userId: user.id } });
  const products = await prisma.product.findMany();
  const transactions = await prisma.ledgerTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { agent: true, product: true }
  });

  // MVP Hack: Calculate Platform Revenue from all Purchase transactions
  // In a real app, the Platform/Sellers would have their own User/Wallet records.
  const allTransactions = await prisma.ledgerTransaction.findMany({ where: { type: 'PURCHASE' }});
  const platformRevenue = allTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <main className="min-h-screen bg-dark-bg p-8 text-white selection:bg-neon-blue selection:text-black">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex justify-between items-center pb-6 border-b border-gray-800">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neon-blue drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]">
              AGENT<span className="text-white">GOODS</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">M2M Protocol Gateway • Phase 1 MVP</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right glass px-6 py-3 rounded-xl border border-neon-blue/30">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Master Wallet (Buyer)</p>
              <p className="text-2xl font-mono text-white font-bold">
                ${user.balance.toFixed(2)} <span className="text-sm text-gray-500 font-sans">USDC</span>
              </p>
            </div>
            <div className="text-right glass px-6 py-3 rounded-xl border border-green-500/30">
              <p className="text-xs text-green-400 uppercase tracking-wider">Platform Revenue</p>
              <p className="text-2xl font-mono text-green-400 font-bold">
                +${platformRevenue.toFixed(2)} <span className="text-sm text-gray-500 font-sans">USDC</span>
              </p>
            </div>
          </div>
        </header>

        {/* Main Dashboard Client (Interactive) */}
        <DashboardClient 
          user={user} 
          agents={agents} 
          products={products} 
          transactions={transactions} 
        />

      </div>
    </main>
  );
}

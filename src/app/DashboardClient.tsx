"use client"

import { useState, useRef, useEffect } from "react"
import type { User, Agent, Product, LedgerTransaction } from "@prisma/client"
import { createAgent, deleteAgent, createProduct, deleteProduct, depositFunds } from "./actions"
import type { CreateAgentResult } from "./actions"
import {
  Bot, Package, Activity, Key, Trash2, CreditCard,
  Server, X, DollarSign, AlertCircle, CheckCircle2, Copy, Sparkles,
  ChevronDown, Zap, Store, TrendingUp, Shield, ShoppingCart,
  BadgeCheck, Users, BarChart3, Wallet, LogOut
} from "lucide-react"
import { useToast } from "@/components/toast"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

// ─── Types ───────────────────────────────────────────────────────────────────

type TransactionWithRelations = LedgerTransaction & {
  agent: Agent | null
  product: Product | null
}

interface ProductStats {
  purchases: number
  revenue: number // cents
}

interface DashboardClientProps {
  user: User
  agents: Agent[]
  myProducts: Product[]
  allProducts: Product[]
  transactions: TransactionWithRelations[]
  buyerTransactions: TransactionWithRelations[]
  productStats: Record<string, ProductStats>
  platformRevenue: number
}

type Role = "buyer" | "seller"

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardClient({
  user, agents, myProducts, allProducts, transactions,
  buyerTransactions, productStats, platformRevenue,
}: DashboardClientProps) {
  const toast = useToast()
  const [role, setRole] = useState<Role>("buyer")
  const [activeTab, setActiveTab] = useState<string>("agents")
  const [showDeposit, setShowDeposit] = useState(false)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)

  // ── Optimistic local state ──
  const [localAgents, setLocalAgents] = useState(agents)
  const [localMyProducts, setLocalMyProducts] = useState(myProducts)
  const [localAllProducts, setLocalAllProducts] = useState(allProducts)

  // Sync from server props (triggers after revalidatePath completes)
  useEffect(() => { setLocalAgents(agents) }, [agents])
  useEffect(() => { setLocalMyProducts(myProducts) }, [myProducts])
  useEffect(() => { setLocalAllProducts(allProducts) }, [allProducts])

  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-16">
      {/* ── Header ── */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-5 border-b border-gray-800/50">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-neon-blue drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]">
            AGENT<span className="text-white">GOODS</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">M2M Protocol Gateway</p>
        </div>

        {/* KPI Cards */}
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:flex-initial glass px-4 py-2.5 rounded-xl border border-neon-blue/20">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Wallet</p>
            <p className="text-xl font-mono font-bold">
              ${fmtCents(user.balance)}
            </p>
            {user.bonusExpiresAt && new Date(user.bonusExpiresAt) > new Date() && (
              <p className="text-[10px] text-neon-blue/70 mt-0.5">
                $5 bonus · expires {new Date(user.bonusExpiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex-1 sm:flex-initial glass px-4 py-2.5 rounded-xl border border-green-500/20">
            <p className="text-[11px] text-green-500/70 uppercase tracking-wider">Earnings</p>
            <p className="text-xl font-mono text-green-400 font-bold">
              +${fmtCents(user.earnings)}
            </p>
          </div>

          {/* User + Logout */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-gray-500 hidden sm:block">{user.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Role Switcher ── */}
      <div className="flex items-center gap-6 py-4 border-b border-gray-800/50">
        <div className="flex bg-white/5 rounded-xl p-1 gap-1">
          {([
            { id: "buyer" as Role, label: "Buyer", icon: ShoppingCart, desc: "Agents & Spending" },
            { id: "seller" as Role, label: "Seller", icon: Store, desc: "Products & Revenue" },
          ]).map((r) => {
            const Icon = r.icon
            const isActive = role === r.id
            return (
              <button
                key={r.id}
                onClick={() => { setRole(r.id); setActiveTab(r.id === "buyer" ? "agents" : "my-products") }}
                className={`flex items-center gap-2.5 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-neon-blue/15 text-white border border-neon-blue/30 shadow-[0_0_12px_rgba(0,243,255,0.15)]"
                    : "text-gray-500 hover:text-gray-300 border border-transparent"
                }`}
              >
                <Icon size={17} />
                <div className="text-left">
                  <div className="text-sm font-bold">{r.label}</div>
                  <div className="text-[11px] text-gray-600 leading-tight">{r.desc}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Quick Actions (role-dependent) */}
        <div className="flex items-center gap-3 ml-auto">
          {role === "buyer" && (
            <>
              <button
                onClick={() => setShowDeposit(!showDeposit)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  showDeposit
                    ? "bg-neon-purple/20 text-neon-purple border-neon-purple/40"
                    : "bg-white/5 text-gray-300 border-gray-700 hover:border-gray-500"
                }`}
              >
                <CreditCard size={16} /> Deposit
                <ChevronDown size={14} className={`transition-transform ${showDeposit ? "rotate-180" : ""}`} />
              </button>
              <button
                onClick={() => setShowAgentModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20 transition-all"
              >
                <Zap size={16} /> New Agent
              </button>
            </>
          )}
          {role === "seller" && (
            <button
              onClick={() => setShowProductModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-neon-purple/10 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/20 transition-all"
            >
              <Store size={16} /> Publish SKU
            </button>
          )}

          {/* Count summary */}
          <span className="text-xs text-gray-600 ml-2">
            {role === "buyer" ? `${localAgents.length} agents` : `${localMyProducts.length} products`}
          </span>
        </div>
      </div>

      {/* ── Deposit Expand ── */}
      {showDeposit && role === "buyer" && <DepositPanel />}

      {/* ── Tab Bar (role-dependent) ── */}
      {role === "buyer" && (
        <TabBar
          tabs={[
            { id: "agents", label: "My Agents", icon: Bot },
            { id: "buyer-marketplace", label: "Marketplace", icon: BarChart3 },
            { id: "transactions", label: "Transactions", icon: Activity },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      )}
      {role === "seller" && (
        <TabBar
          tabs={[
            { id: "my-products", label: "My Products", icon: Package },
            { id: "catalog", label: "Marketplace", icon: BarChart3 },
            { id: "sales-ledger", label: "Sales Ledger", icon: Activity },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      )}

      {/* ── Tab Content ── */}
      <div className="min-h-[50vh]">
        {/* Buyer: Agents */}
        {role === "buyer" && activeTab === "agents" && (
          <AgentsList
            agents={localAgents}
            onDelete={(id) => setLocalAgents((prev) => prev.filter((a) => a.id !== id))}
          />
        )}
        {/* Buyer: Marketplace */}
        {role === "buyer" && activeTab === "buyer-marketplace" && (
          <MarketplaceCatalog
            products={localAllProducts}
            stats={productStats}
            currentUserId={user.id}
            onDelete={(id) => {
              setLocalAllProducts((prev) => prev.filter((p) => p.id !== id))
              setLocalMyProducts((prev) => prev.filter((p) => p.id !== id))
            }}
          />
        )}
        {/* Buyer: Transactions */}
        {role === "buyer" && activeTab === "transactions" && (
          <LedgerTable transactions={buyerTransactions} />
        )}

        {/* Seller: My Products */}
        {role === "seller" && activeTab === "my-products" && (
          <SellerProducts
            products={localMyProducts}
            stats={productStats}
            totalEarnings={user.earnings}
            onDelete={(id) => setLocalMyProducts((prev) => prev.filter((p) => p.id !== id))}
          />
        )}
        {/* Seller: Catalog (all products discovery) */}
        {role === "seller" && activeTab === "catalog" && (
          <MarketplaceCatalog
            products={localAllProducts}
            stats={productStats}
            currentUserId={user.id}
            onDelete={(id) => {
              setLocalAllProducts((prev) => prev.filter((p) => p.id !== id))
              setLocalMyProducts((prev) => prev.filter((p) => p.id !== id))
            }}
          />
        )}
        {/* Seller: Sales Ledger */}
        {role === "seller" && activeTab === "sales-ledger" && (
          <LedgerTable transactions={transactions.filter(tx =>
            tx.type === "PURCHASE" && tx.product?.ownerId === user.id
          )} />
        )}
      </div>

      {/* ── Modals ── */}
      {showAgentModal && (
        <CreateAgentModal onClose={() => setShowAgentModal(false)} />
      )}
      {showProductModal && (
        <CreateProductModal onClose={() => setShowProductModal(false)} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab Bar
// ═══════════════════════════════════════════════════════════════════════════════

function TabBar({
  tabs, active, onChange,
}: {
  tabs: { id: string; label: string; icon: typeof Bot }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <nav className="flex gap-1 mt-6 mb-8" role="tablist">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? "bg-white/10 text-white border border-white/10"
                : "text-gray-500 hover:text-gray-300 border border-transparent hover:bg-white/5"
            }`}
          >
            <Icon size={17} className={isActive ? "text-neon-blue" : ""} />
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Deposit Panel
// ═══════════════════════════════════════════════════════════════════════════════

function DepositPanel() {
  const toast = useToast()
  const [customAmount, setCustomAmount] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")

  async function doDeposit(amount: number) {
    setStatus("loading")
    const result = await depositFunds(amount)
    setStatus(result.success ? "success" : "error")
    toast.addToast(result.success ? `Deposited $${amount}` : result.error ?? "Failed", result.success ? "success" : "error")
    setTimeout(() => setStatus("idle"), 2000)
  }

  async function handleCustom() {
    const amount = parseFloat(customAmount)
    if (isNaN(amount) || amount <= 0 || amount > 10000) {
      toast.addToast("Enter a valid amount ($0.01–$10,000)", "error")
      return
    }
    await doDeposit(amount)
    setCustomAmount("")
  }

  return (
    <div className="glass rounded-2xl p-6 border border-neon-purple/20 bg-gradient-to-r from-neon-purple/5 to-transparent mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <DollarSign size={18} className="text-neon-purple" />
        <span className="text-sm font-bold uppercase tracking-wide text-gray-300 mr-2">Add Funds</span>

        {[10, 50, 100, 500].map((amount) => (
          <button key={amount} onClick={() => doDeposit(amount)} disabled={status === "loading"}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-black/50 border border-gray-700 text-white hover:bg-neon-purple/20 hover:border-neon-purple/50 transition-all disabled:opacity-50">
            +${amount}
          </button>
        ))}

        <div className="h-8 w-px bg-gray-800 hidden sm:block" />

        <input type="number" min="0.01" max="10000" step="0.01" placeholder="Custom…"
          className="w-32 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-neon-purple outline-none"
          value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCustom()} />
        <button onClick={handleCustom} disabled={status === "loading"}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-neon-purple text-white hover:bg-neon-purple/80 transition-all disabled:opacity-50">
          {status === "loading" ? "…" : "Deposit"}
        </button>

        {status === "error" && (
          <span className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={14} /> Failed</span>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Agents List (Buyer)
// ═══════════════════════════════════════════════════════════════════════════════

function AgentsList({ agents, onDelete }: { agents: Agent[]; onDelete: (id: string) => void }) {
  const toast = useToast()

  if (agents.length === 0) {
    return (
      <EmptyState icon={Bot} title="No AI Agents yet"
        description="Create your first Agent to start making purchases through the M2M gateway. Each Agent gets a unique API key and a spend budget."
      />
    )
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => {
        const pct = agent.maxBudget > 0 ? Math.min(100, Math.round((agent.currentSpend / agent.maxBudget) * 100)) : 0
        const isOver = agent.currentSpend > agent.maxBudget

        return (
          <div key={agent.id} className="glass rounded-2xl p-5 border border-gray-800 hover:border-neon-blue/20 transition-all group">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center shrink-0">
                    <Bot size={18} className="text-neon-blue" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg truncate">{agent.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 font-mono">
                      <Key size={11} /> {agent.apiKeyPrefix}…
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 shrink-0">
                <div className="text-right min-w-[140px]">
                  <div className="flex items-center justify-end gap-2 mb-1.5">
                    <span className="text-xs text-gray-500">
                      ${fmtCents(agent.currentSpend)} <span className="text-gray-700">/</span> ${fmtCents(agent.maxBudget)}
                    </span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${isOver ? "bg-red-500/20 text-red-400" : "bg-neon-blue/10 text-neon-blue"}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${isOver ? "bg-red-500" : pct > 80 ? "bg-yellow-500/80" : "bg-neon-blue"}`}
                      style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>

                <button onClick={async () => {
                  if (!confirm(`Delete "${agent.name}"?`)) return
                  onDelete(agent.id)
                  const r = await deleteAgent(agent.id)
                  if (!r.success) {
                    toast.addToast(r.error ?? "Deletion failed.", "error")
                  }
                }} className="text-gray-700 hover:text-red-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Seller: My Products with stats
// ═══════════════════════════════════════════════════════════════════════════════

function SellerProducts({
  products, stats, totalEarnings, onDelete,
}: {
  products: Product[]
  stats: Record<string, ProductStats>
  totalEarnings: number
  onDelete?: (id: string) => void
}) {
  // Compute summary
  const totalSales = products.reduce((sum, p) => sum + (stats[p.id]?.purchases ?? 0), 0)

  if (products.length === 0) {
    return (
      <EmptyState icon={Store} title="No products listed yet"
        description="Publish your first API product. Agents will discover and purchase it automatically through the catalog."
      />
    )
  }

  return (
    <div>
      {/* Seller KPI bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="glass rounded-2xl p-4 border border-green-500/20">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Total Earnings</p>
          <p className="text-2xl font-mono text-green-400 font-bold">+${fmtCents(totalEarnings)}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-neon-blue/20">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Products Listed</p>
          <p className="text-2xl font-mono font-bold">{products.length}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-neon-purple/20">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Total Sales</p>
          <p className="text-2xl font-mono font-bold">{totalSales}</p>
        </div>
      </div>

      {/* Product cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((prod) => {
          const s = stats[prod.id]
          return (
            <ProductCard
              key={prod.id}
              product={prod}
              purchases={s?.purchases ?? 0}
              revenue={s?.revenue ?? 0}
              showOwner={false}
              onDelete={onDelete}
            />
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Marketplace Catalog (all products, with owner badges)
// ═══════════════════════════════════════════════════════════════════════════════

function MarketplaceCatalog({
  products, stats, currentUserId, onDelete,
}: {
  products: Product[]
  stats: Record<string, ProductStats>
  currentUserId: string
  onDelete?: (id: string) => void
}) {
  if (products.length === 0) {
    return (
      <EmptyState icon={Package} title="Marketplace is empty"
        description="No products have been published yet. Be the first seller!"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {products.map((prod) => {
        const s = stats[prod.id]
        return (
          <ProductCard
            key={prod.id}
            product={prod}
            purchases={s?.purchases ?? 0}
            revenue={s?.revenue ?? 0}
            showOwner={true}
            currentUserId={currentUserId}
            onDelete={onDelete}
          />
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Product Card (shared between Seller view + Catalog)
// ═══════════════════════════════════════════════════════════════════════════════

function ProductCard({
  product, purchases, revenue, showOwner, currentUserId, onDelete,
}: {
  product: Product
  purchases: number
  revenue: number
  showOwner: boolean
  currentUserId?: string
  onDelete?: (id: string) => void
}) {
  const toast = useToast()
  const isOfficial = !product.ownerId
  const isOwn = product.ownerId === currentUserId

  return (
    <div className="glass rounded-2xl p-5 border border-gray-800 hover:border-neon-purple/20 transition-all group relative">
      {/* Owner badge */}
      {showOwner && (
        <div className="absolute top-3 left-3 z-10">
          {isOfficial ? (
            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-neon-blue/10 text-neon-blue border border-neon-blue/20">
              <BadgeCheck size={11} /> Official
            </span>
          ) : isOwn ? (
            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              <Shield size={11} /> Your SKU
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-gray-700">
              <Users size={11} /> Seller
            </span>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3 pt-4">
        <div className="w-8 h-8 rounded-lg bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center shrink-0">
          <Server size={15} className="text-neon-purple" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-sm truncate">{product.name}</h3>
          {product.isSubscription && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-neon-purple/15 text-neon-purple border border-neon-purple/20 uppercase tracking-wide">
              Subscription
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-2">
        {product.description || "No description"}
      </p>

      {product.schemaString && (
        <div className="mb-4 p-2.5 rounded-lg bg-black/40 border border-gray-800/50 text-[11px] font-mono text-gray-500 truncate">
          {product.schemaString.slice(0, 60)}{product.schemaString.length > 60 ? "…" : ""}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-3 text-[11px] text-gray-600">
        <span className="flex items-center gap-1">
          <ShoppingCart size={11} /> {purchases} sold
        </span>
        {revenue > 0 && (
          <span className="flex items-center gap-1 text-green-500/70">
            <TrendingUp size={11} /> +${fmtCents(revenue)}
          </span>
        )}
      </div>

      {/* Footer: ID + Price */}
      <div className="flex items-end justify-between pt-3 border-t border-gray-800/50">
        <p className="text-[11px] font-mono text-gray-600 truncate max-w-[50%]">
          {product.id.slice(0, 12)}…
        </p>
        <p className="font-mono font-bold text-neon-blue text-lg">
          ${fmtCents(product.price)}
        </p>
      </div>

      {/* Delete (own products only) */}
      {isOwn && (
        <button onClick={async () => {
          if (!confirm(`Delete "${product.name}"?`)) return
          onDelete?.(product.id)
          const r = await deleteProduct(product.id)
          if (!r.success) toast.addToast(r.error ?? "Deletion failed.", "error")
        }} className="absolute top-3 right-3 text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Ledger Table (shared)
// ═══════════════════════════════════════════════════════════════════════════════

function LedgerTable({ transactions }: { transactions: TransactionWithRelations[] }) {
  if (transactions.length === 0) {
    return (
      <EmptyState icon={Activity} title="No transactions yet"
        description="Deposit funds or make purchases — every action will appear here."
      />
    )
  }

  return (
    <div className="space-y-1">
      <div className="hidden sm:grid grid-cols-[1fr_100px_100px_100px] gap-4 px-4 py-2 text-[11px] uppercase tracking-wider text-gray-600">
        <span>Detail</span>
        <span className="text-right">Type</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Time</span>
      </div>

      {transactions.map((tx) => (
        <div key={tx.id}
          className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_100px] gap-x-4 gap-y-2 sm:gap-y-0 items-center px-4 py-3 rounded-xl hover:bg-white/[0.02] border border-transparent hover:border-gray-800/50 transition-all">
          <div className="text-sm min-w-0">
            {tx.type === "DEPOSIT" ? (
              <span className="text-gray-300"><span className="text-green-400 font-medium">Deposit</span> to Wallet</span>
            ) : tx.type === "REFUND" ? (
              <span className="text-gray-300"><span className="text-yellow-400 font-medium">Refund</span> {tx.product?.name ?? "N/A"}</span>
            ) : (
              <span className="text-gray-300">
                <span className="text-neon-blue font-medium">{tx.agent?.name ?? "Unknown"}</span>
                {" → "}
                <span className="text-neon-purple">{tx.product?.name ?? "N/A"}</span>
              </span>
            )}
          </div>

          <div className="sm:text-right">
            <span className={`inline-block text-[11px] font-mono px-2 py-0.5 rounded uppercase ${
              tx.type === "PURCHASE" ? "bg-red-500/10 text-red-400"
                : tx.type === "REFUND" ? "bg-yellow-500/10 text-yellow-400"
                : "bg-green-500/10 text-green-400"
            }`}>{tx.type}</span>
          </div>

          <div className={`sm:text-right font-mono text-sm font-bold ${
            tx.type === "DEPOSIT" || tx.type === "REFUND" ? "text-green-400" : "text-red-400"
          }`}>
            {tx.type === "DEPOSIT" || tx.type === "REFUND" ? "+" : "−"}${fmtCents(tx.amount)}
          </div>

          <div className="sm:text-right text-xs text-gray-600 font-mono">
            {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════════════════════════════

function EmptyState({
  icon: Icon, title, description,
}: {
  icon: typeof Bot
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-gray-800 flex items-center justify-center mb-6">
        <Icon size={28} className="text-gray-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-300 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 max-w-md leading-relaxed">{description}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Create Agent Modal
// ═══════════════════════════════════════════════════════════════════════════════

function CreateAgentModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState("")
  const [budget, setBudget] = useState(100)
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<{ name: string; apiKey: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (created) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="glass rounded-2xl p-8 max-w-lg w-full mx-4 border border-green-500/30">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-green-400" />
            </div>
            <h3 className="text-xl font-bold mb-1">Agent Created</h3>
            <p className="text-sm text-gray-400 mb-6">
              <span className="text-white font-medium">{created.name}</span> is ready.
              Copy the API key — <strong>shown only once</strong>.
            </p>
            <div className="bg-black/60 border border-neon-blue/30 rounded-xl p-4 mb-4 font-mono text-sm text-neon-blue break-all select-all">
              {created.apiKey}
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { navigator.clipboard.writeText(created.apiKey); toast.addToast("Copied!") }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-blue/20 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/30 transition-all text-sm font-medium">
                <Copy size={15} /> Copy Key
              </button>
              <button onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-white/5 text-gray-300 border border-gray-700 hover:bg-white/10 transition-all text-sm">
                Done
              </button>
            </div>
          </div>
        </div>
      </ModalOverlay>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.addToast("Agent name required.", "error"); return }
    setLoading(true)
    const result: CreateAgentResult = await createAgent(name, budget)
    setLoading(false)
    if (result.success && result.apiKey) setCreated({ name: name.trim(), apiKey: result.apiKey })
    else toast.addToast(result.error ?? "Creation failed.", "error")
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="glass rounded-2xl p-8 max-w-md w-full mx-4 border border-neon-blue/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center">
              <Bot size={20} className="text-neon-blue" />
            </div>
            <h3 className="text-lg font-bold">Create AI Agent</h3>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white p-1"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Agent Name</label>
            <input ref={inputRef} type="text" placeholder="e.g. Shopping Bot, Data Miner…"
              className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:border-neon-blue outline-none"
              value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Monthly Budget (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input type="number" min={1} max={100000}
                className="w-full bg-black/50 border border-gray-700 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:border-neon-blue outline-none"
                value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 border border-gray-700 hover:bg-white/10 text-sm">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-neon-blue text-black font-bold hover:bg-neon-blue/90 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? "Creating…" : <><Sparkles size={15} /> Create Agent</>}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Create Product Modal
// ═══════════════════════════════════════════════════════════════════════════════

function CreateProductModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState(1)
  const [isSubscription, setIsSubscription] = useState(false)
  const [schema, setSchema] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.addToast("Product name required.", "error"); return }
    if (price <= 0) { toast.addToast("Price must be > 0.", "error"); return }
    setLoading(true)
    const result = await createProduct(name, description, price, isSubscription, schema || undefined)
    setLoading(false)
    if (result.success) { toast.addToast(`"${name.trim()}" published`); onClose() }
    else toast.addToast(result.error ?? "Creation failed.", "error")
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="glass rounded-2xl p-8 max-w-lg w-full mx-4 border border-neon-purple/20 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center">
              <Store size={20} className="text-neon-purple" />
            </div>
            <h3 className="text-lg font-bold">Publish Digital Good</h3>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white p-1"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Product Name</label>
            <input ref={inputRef} type="text" placeholder="e.g. Weather API, Stock Data…"
              className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:border-neon-purple outline-none"
              value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Description</label>
            <textarea placeholder="What does this API provide?"
              className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:border-neon-purple outline-none resize-none"
              rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Price (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input type="number" min={0.01} step={0.01}
                  className="w-full bg-black/50 border border-gray-700 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:border-neon-purple outline-none"
                  value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer px-4 py-2.5 rounded-xl bg-black/50 border border-gray-700 hover:border-neon-purple/50 w-full">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSubscription ? "bg-neon-purple border-neon-purple" : "border-gray-600"}`}>
                  {isSubscription && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <span className="text-sm text-gray-300">Subscription</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              OpenSchema JSON <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            <textarea placeholder='{"type":"object","properties":{"query":{"type":"string"}}}'
              className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-2.5 text-xs font-mono focus:border-neon-purple outline-none resize-none"
              rows={4} value={schema} onChange={(e) => setSchema(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 border border-gray-700 hover:bg-white/10 text-sm">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-neon-purple text-white font-bold hover:bg-neon-purple/90 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? "Publishing…" : <><Sparkles size={15} /> Publish</>}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Modal Overlay (shared)
// ═══════════════════════════════════════════════════════════════════════════════

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {children}
    </div>
  )
}

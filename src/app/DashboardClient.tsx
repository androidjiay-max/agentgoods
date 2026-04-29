"use client"

import { useState } from "react"
import { createAgent, deleteAgent, createProduct, deleteProduct, depositFunds } from "./actions"
import { Bot, Key, Plus, Trash2, Cpu, Activity, Database, Server, CreditCard } from "lucide-react"

export default function DashboardClient({ user, agents, products, transactions }: any) {
  const [newAgentName, setNewAgentName] = useState("")
  const [newAgentBudget, setNewAgentBudget] = useState(100)

  const [newProdName, setNewProdName] = useState("")
  const [newProdDesc, setNewProdDesc] = useState("")
  const [newProdPrice, setNewProdPrice] = useState(1)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Left Column: Agents & Products */}
      <div className="lg:col-span-2 space-y-8">
        
        {/* Top Up Section */}
        <section className="glass rounded-2xl p-6 border border-gray-800 bg-gradient-to-r from-neon-purple/10 to-transparent">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><CreditCard className="text-neon-purple"/> Deposit Funds (Stripe / USDC)</h2>
              <p className="text-sm text-gray-400 mt-1">Add funds to your Master Wallet to power your Agents.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => depositFunds(user.id, 10)} className="bg-black/50 hover:bg-neon-purple/20 text-white px-4 py-2 rounded-lg text-sm transition-colors border border-gray-700 hover:border-neon-purple">+$10</button>
              <button onClick={() => depositFunds(user.id, 50)} className="bg-black/50 hover:bg-neon-purple/20 text-white px-4 py-2 rounded-lg text-sm transition-colors border border-gray-700 hover:border-neon-purple">+$50</button>
              <button onClick={() => depositFunds(user.id, 100)} className="bg-neon-purple text-white px-4 py-2 rounded-lg text-sm transition-colors font-bold shadow-[0_0_10px_rgba(188,19,254,0.3)] hover:shadow-[0_0_20px_rgba(188,19,254,0.5)]">+$100</button>
            </div>
          </div>
        </section>
        
        {/* Agents Section */}
        <section className="glass rounded-2xl p-6 border border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2"><Bot className="text-neon-blue"/> Your AI Agents</h2>
            <div className="flex gap-2">
              <input type="text" placeholder="Agent Name" className="bg-black/50 border border-gray-700 rounded px-3 py-1 text-sm focus:border-neon-blue outline-none" value={newAgentName} onChange={e=>setNewAgentName(e.target.value)} />
              <input type="number" placeholder="Budget" className="bg-black/50 border border-gray-700 rounded px-3 py-1 text-sm w-24 focus:border-neon-blue outline-none" value={newAgentBudget} onChange={e=>setNewAgentBudget(Number(e.target.value))} />
              <button 
                onClick={() => { if(newAgentName) createAgent(user.id, newAgentName, newAgentBudget) }}
                className="bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/40 px-3 py-1 rounded text-sm transition-colors border border-neon-blue/50 flex items-center gap-1"
              >
                <Plus size={16}/> Create
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {agents.map((agent: any) => (
              <div key={agent.id} className="bg-black/40 border border-gray-800 p-4 rounded-xl flex justify-between items-center group hover:border-neon-blue/30 transition-colors">
                <div>
                  <h3 className="font-bold text-lg">{agent.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-400 font-mono bg-black px-2 py-1 rounded">
                    <Key size={14} className="text-neon-purple"/> 
                    {agent.apiKey}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Spend / Budget</p>
                    <p className="font-mono text-sm">
                      <span className="text-white">${agent.currentSpend.toFixed(2)}</span> / ${agent.maxBudget.toFixed(2)}
                    </p>
                  </div>
                  <button onClick={() => deleteAgent(agent.id)} className="text-red-500/50 hover:text-red-500 transition-colors p-2">
                    <Trash2 size={18}/>
                  </button>
                </div>
              </div>
            ))}
            {agents.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No agents created yet. Create one to get started.</p>}
          </div>
        </section>

        {/* Products/SKU Section */}
        <section className="glass rounded-2xl p-6 border border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2"><Database className="text-neon-purple"/> Digital Goods (SKUs)</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {products.map((prod: any) => (
              <div key={prod.id} className="bg-black/40 border border-gray-800 p-4 rounded-xl relative group">
                <button onClick={() => deleteProduct(prod.id)} className="absolute top-2 right-2 text-red-500/30 hover:text-red-500 hidden group-hover:block">
                  <Trash2 size={16}/>
                </button>
                <h3 className="font-bold flex items-center gap-2">
                  <Server size={16} className="text-gray-400"/> {prod.name}
                </h3>
                <p className="text-sm text-gray-400 mt-2 h-10">{prod.description}</p>
                <div className="mt-4 flex justify-between items-end">
                  <p className="text-xs font-mono text-gray-500">ID: {prod.id}</p>
                  <p className="font-mono font-bold text-neon-blue">${prod.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-4 mt-4">
            <h4 className="text-sm font-bold text-gray-400 mb-3">Add New SKU</h4>
            <div className="flex gap-2">
              <input type="text" placeholder="Name" className="bg-black/50 border border-gray-700 rounded px-3 py-2 text-sm flex-1 focus:border-neon-purple outline-none" value={newProdName} onChange={e=>setNewProdName(e.target.value)} />
              <input type="text" placeholder="Description" className="bg-black/50 border border-gray-700 rounded px-3 py-2 text-sm flex-[2] focus:border-neon-purple outline-none" value={newProdDesc} onChange={e=>setNewProdDesc(e.target.value)} />
              <input type="number" placeholder="Price" className="bg-black/50 border border-gray-700 rounded px-3 py-2 text-sm w-24 focus:border-neon-purple outline-none" value={newProdPrice} onChange={e=>setNewProdPrice(Number(e.target.value))} />
              <button 
                onClick={() => { if(newProdName) createProduct(newProdName, newProdDesc, newProdPrice) }}
                className="bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/40 px-4 py-2 rounded text-sm transition-colors border border-neon-purple/50"
              >
                Publish
              </button>
            </div>
          </div>
        </section>

      </div>

      {/* Right Column: Ledger Log */}
      <div className="space-y-8">
        <section className="glass rounded-2xl p-6 border border-gray-800 h-full">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><Activity className="text-green-400"/> Live Ledger</h2>
          <div className="space-y-3">
            {transactions.map((tx: any) => (
              <div key={tx.id} className="text-sm font-mono border-b border-gray-800 pb-3 last:border-0">
                <div className="flex justify-between text-gray-400 mb-1">
                  <span>{new Date(tx.createdAt).toLocaleTimeString()}</span>
                  <span className={tx.type === 'PURCHASE' ? 'text-red-400' : 'text-green-400'}>{tx.type}</span>
                </div>
                <div className="text-white">
                  Agent <span className="text-neon-blue">{tx.agent?.name}</span> bought <span className="text-neon-purple">{tx.product?.name}</span>
                </div>
                <div className="text-right mt-1 font-bold text-gray-300">
                  -${tx.amount.toFixed(2)}
                </div>
              </div>
            ))}
            {transactions.length === 0 && <p className="text-gray-500 text-sm text-center">No transactions yet.</p>}
          </div>
        </section>
      </div>

    </div>
  )
}

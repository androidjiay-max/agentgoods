"use client"

import Link from "next/link"
import { useI18n } from "@/lib/i18n/provider"
import { Bot, Zap, Store, Shield, ArrowRight, Languages, Activity, ShoppingCart } from "lucide-react"

export default function LandingPage() {
  const { t, toggleLang } = useI18n()

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      <nav className="border-b border-gray-800/50 px-6 lg:px-10 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Bot size={24} className="text-neon-blue" />
          <span className="font-bold text-lg text-neon-blue drop-shadow-[0_0_6px_rgba(0,243,255,0.3)]">AGENT<span className="text-white">GOODS</span></span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleLang} className="flex items-center gap-1 text-xs text-gray-500 hover:text-neon-blue transition-colors">
            <Languages size={14} /> {t("langSwitch")}
          </button>
          <Link href="https://agentgoods.io/login" className="px-4 py-2 rounded-lg text-sm font-medium bg-neon-blue text-black hover:bg-neon-blue/90 transition-all">
            {t("common.signIn")}
          </Link>
        </div>
      </nav>

      <section className="px-6 lg:px-10 py-20 lg:py-32 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20 text-xs text-neon-blue mb-6">
          <Zap size={14} /> {t("landing.badge")}
        </div>
        <h1 className="text-4xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
          {t("landing.heroTitle")}<br />
          <span className="text-neon-blue drop-shadow-[0_0_12px_rgba(0,243,255,0.3)]">{t("landing.heroHighlight")}</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">{t("landing.heroDesc")}</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="https://agentgoods.io/login" className="px-8 py-3 rounded-xl bg-neon-blue text-black font-bold hover:bg-neon-blue/90 transition-all text-sm shadow-[0_0_20px_rgba(0,243,255,0.2)]">
            {t("landing.getStarted")}
          </Link>
          <Link href="https://agentgoods.io/login" className="px-8 py-3 rounded-xl bg-white/5 border border-gray-700 text-gray-300 hover:bg-white/10 transition-all text-sm">
            {t("landing.viewMarketplace")}
          </Link>
        </div>
      </section>

      <section className="px-6 lg:px-10 py-20 max-w-6xl mx-auto">
        <h2 className="text-2xl lg:text-3xl font-bold text-center mb-16">{t("landing.howItWorks")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Bot, title: t("landing.step1Title"), desc: t("landing.step1Desc") },
            { icon: ShoppingCart, title: t("landing.step2Title"), desc: t("landing.step2Desc") },
            { icon: Activity, title: t("landing.step3Title"), desc: t("landing.step3Desc") },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-6 border border-gray-800 hover:border-neon-blue/20 transition-all text-center">
              <div className="w-12 h-12 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center mx-auto mb-4">
                <Icon size={22} className="text-neon-blue" />
              </div>
              <h3 className="font-bold mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 lg:px-10 py-20 max-w-6xl mx-auto">
        <div className="glass rounded-3xl p-10 lg:p-16 border border-gray-800 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-purple/10 border border-neon-purple/20 text-xs text-neon-purple mb-6">
            <Store size={14} /> {t("landing.sellerBadge")}
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold mb-4">{t("landing.sellerTitle")}</h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-8 leading-relaxed">{t("landing.sellerDesc")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {[
              { icon: Shield, title: t("landing.seller1Title"), desc: t("landing.seller1Desc") },
              { icon: Zap, title: t("landing.seller2Title"), desc: t("landing.seller2Desc") },
              { icon: Activity, title: t("landing.seller3Title"), desc: t("landing.seller3Desc") },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3">
                <Icon size={20} className="text-neon-purple shrink-0 mt-0.5" />
                <div><h4 className="font-bold text-sm mb-1">{title}</h4><p className="text-xs text-gray-500 leading-relaxed">{desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 lg:px-10 py-20 text-center">
        <h2 className="text-2xl lg:text-3xl font-bold mb-4">{t("landing.ctaTitle")}</h2>
        <p className="text-gray-400 mb-8">{t("landing.ctaDesc")}</p>
        <Link href="https://agentgoods.io/login" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-neon-blue text-black font-bold hover:bg-neon-blue/90 transition-all text-sm shadow-[0_0_20px_rgba(0,243,255,0.2)]">
          {t("landing.ctaButton")} <ArrowRight size={16} />
        </Link>
      </section>

      <footer className="border-t border-gray-800/50 px-6 lg:px-10 py-8 text-center text-xs text-gray-600">
        {t("landing.footer")}
      </footer>
    </div>
  )
}

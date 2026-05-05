"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useI18n } from "@/lib/i18n/provider"
import { LogIn, UserPlus, AlertCircle, CheckCircle2, Languages, Terminal } from "lucide-react"

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
)
const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
)

type Mode = "signin" | "signup"

export default function LoginPage() {
  const { t, toggleLang } = useI18n()
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setSuccess(""); setLoading(true)
    const supabase = createClient()
    if (mode === "signup") {
      const { error: e2 } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/` } })
      if (e2) { setError(e2.message); setLoading(false); return }
      setSuccess(t("login.checkEmail")); setMode("signin"); setPassword(""); setLoading(false); return
    }
    const { error: e2 } = await supabase.auth.signInWithPassword({ email, password })
    if (e2) { setError(e2.message); setLoading(false); return }
    router.push("/"); router.refresh()
  }

  return (
    <main className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
      <button onClick={toggleLang}
        className="fixed top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-gray-500 hover:text-neon-blue bg-dark-panel border border-border-subtle transition-all z-50 font-mono">
        <Languages size={14} /> {t("langSwitch")}
      </button>

      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Terminal size={16} className="text-neon-blue" />
            <h1 className="text-xs font-mono text-gray-500 tracking-wide">agentgoods.io</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="panel p-6 space-y-4">
            <div className="flex bg-dark-bg rounded p-0.5 border border-border-subtle">
              {(["signin", "signup"] as Mode[]).map((m) => (
                <button key={m} type="button" onClick={() => { setMode(m); setError(""); setSuccess("") }}
                  className={`flex-1 py-1.5 rounded-sm text-xs font-mono transition-all ${mode === m ? "bg-neon-blue/10 text-neon-blue" : "text-gray-600 hover:text-gray-400"}`}>
                  {m === "signin" ? t("common.signIn") : t("common.createAccount")}
                </button>
              ))}
            </div>

            {error && <div className="flex items-center gap-2 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-3 py-2 font-mono"><AlertCircle size={13} /> {error}</div>}
            {success && <div className="flex items-center gap-2 text-[11px] text-green-400 bg-green-500/5 border border-green-500/20 rounded px-3 py-2 font-mono"><CheckCircle2 size={13} /> {success}</div>}

            <div>
              <label className="block text-[11px] text-gray-500 mb-1.5 font-mono">{t("login.email")}</label>
              <input type="email" required placeholder="you@example.com"
                className="w-full bg-dark-bg border border-border-subtle rounded px-4 py-2.5 text-sm font-mono focus:border-neon-blue outline-none placeholder:text-gray-700"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div>
              <label className="block text-[11px] text-gray-500 mb-1.5 font-mono">{t("login.password")}</label>
              <input type="password" required minLength={6} placeholder="••••••••"
                className="w-full bg-dark-bg border border-border-subtle rounded px-4 py-2.5 text-sm font-mono focus:border-neon-blue outline-none placeholder:text-gray-700"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded bg-white text-black font-bold hover:bg-gray-200 transition-all text-sm font-mono disabled:opacity-50 flex items-center justify-center gap-2">
              {mode === "signup" ? <UserPlus size={15} /> : <LogIn size={15} />}
              {loading ? t("common.loading") : mode === "signup" ? t("login.createBtn") : t("login.signInBtn")}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border-subtle" />
              <span className="text-[10px] text-gray-600 font-mono">{t("login.orContinue")}</span>
              <div className="flex-1 h-px bg-border-subtle" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[{ provider: "google" as const, icon: GoogleIcon, label: "Google" }, { provider: "github" as const, icon: GitHubIcon, label: "GitHub" }].map(({ provider, icon: Icon, label }) => (
                <button key={provider} type="button"
                  onClick={async () => { const supabase = createClient(); await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback` } }) }}
                  className="flex items-center justify-center gap-1.5 py-2 rounded bg-dark-bg border border-border-subtle hover:border-gray-600 transition-all text-xs text-gray-400 font-mono">
                  <Icon /> {label}
                </button>
              ))}
            </div>
          </form>

          <div className="flex justify-between items-center mt-3">
            <a href="https://agentgoods.shop" target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-gray-600 hover:text-neon-blue transition-colors font-mono flex items-center gap-1">
              {t("login.whatIs")}
            </a>
            <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="text-[11px] text-gray-600 hover:text-gray-400 font-mono">
              {mode === "signup" ? t("login.signInLink") : t("login.createOne")}
            </button>
          </div>
        </div>
    </main>
  )
}

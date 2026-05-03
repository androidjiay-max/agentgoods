"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { dict, type Lang } from "./dict"

interface I18nContextValue {
  lang: Lang
  t: (key: string, vars?: Record<string, string>) => string
  toggleLang: () => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

/** Get a nested value from the dictionary using dot notation. */
function getNested(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".")
  let current: unknown = obj
  for (const k of keys) {
    if (typeof current !== "object" || current === null) return path
    current = (current as Record<string, unknown>)[k]
  }
  return typeof current === "string" ? current : path
}

/** Replace ${var} placeholders in a template string. */
function template(str: string, vars?: Record<string, string>): string {
  if (!vars) return str
  return str.replace(/\$\{(\w+)\}/g, (_, key) => vars[key] ?? `\${${key}}`)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lang") as Lang) ?? "zh"
    }
    return "zh"
  })

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      const d = dict[lang] as Record<string, unknown>
      const raw = getNested(d, key)
      return template(raw, vars)
    },
    [lang],
  )

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === "zh" ? "en" : "zh"
      localStorage.setItem("lang", next)
      return next
    })
  }, [])

  return (
    <I18nContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}

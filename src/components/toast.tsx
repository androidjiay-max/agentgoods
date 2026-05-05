"use client"

import {
  createContext, useContext, useState, useCallback, type ReactNode,
} from "react"
import { X, AlertCircle, CheckCircle2, Info } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Toast {
  id: string
  message: string
  type: "success" | "error" | "info"
  createdAt: number
}

interface ToastContextValue {
  addToast: (message: string, type?: Toast["type"]) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, type: Toast["type"] = "success") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setToasts((prev) => {
        // Keep max 5 toasts, remove oldest
        const next = [...prev, { id, message, type, createdAt: Date.now() }]
        if (next.length > 5) return next.slice(-5)
        return next
      })

      // Auto-dismiss
      const duration = type === "error" ? 6000 : 4000
      setTimeout(() => removeToast(id), duration)
    },
    [removeToast],
  )

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast stack */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

// ─── Toast Item ──────────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const config = {
    success: {
      bg: "bg-green-950/95 border-green-500/40",
      text: "text-green-200",
      icon: CheckCircle2,
      iconColor: "text-green-400",
    },
    error: {
      bg: "bg-red-950/95 border-red-500/40",
      text: "text-red-200",
      icon: AlertCircle,
      iconColor: "text-red-400",
    },
    info: {
      bg: "bg-neon-blue/10 border-neon-blue/30",
      text: "text-neon-blue",
      icon: Info,
      iconColor: "text-neon-blue",
    },
  }[toast.type]

  const Icon = config.icon

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded text-sm font-medium shadow-lg border max-w-md animate-slide-up ${config.bg} ${config.text}`}
    >
      <Icon size={17} className={`shrink-0 mt-0.5 ${config.iconColor}`} />
      <span className="flex-1 whitespace-pre-wrap leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity -mr-1 -mt-0.5"
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  )
}

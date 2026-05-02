"use client"

import { ToastProvider } from "@/components/toast"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

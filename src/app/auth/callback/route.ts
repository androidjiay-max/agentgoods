import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * OAuth callback — Supabase redirects here after GitHub/Google/Apple auth.
 * Exchanges the auth code for a session cookie, then redirects to dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — back to login
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}

/**
 * Supabase middleware helper — refreshes the session cookie on every request.
 * Used in src/middleware.ts.
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const hostname = request.headers.get("host") ?? ""
  const isMarketingDomain = hostname.includes("agentgoods.shop") ||
    hostname.includes("agentgoods-shop") // Vercel preview domain

  // Marketing domain (agentgoods.shop) — serve landing page, no auth
  if (isMarketingDomain) {
    const path = request.nextUrl.pathname
    // Redirect root to landing page
    if (path === "/") {
      const url = request.nextUrl.clone()
      url.pathname = "/landing"
      return NextResponse.rewrite(url)
    }
    // Allow landing page, static assets, API routes through without auth
    return supabaseResponse
  }

  // Refresh the session — important to keep the cookie fresh
  const { data: { user } } = await supabase.auth.getUser()

  // Protect dashboard routes — redirect to /login if unauthenticated
  const path = request.nextUrl.pathname
  const isApiRoute = path.startsWith("/api/") || path.startsWith("/services/")
  const isLoginPage = path === "/login"
  const isAuthRoute = path.startsWith("/auth/")
  const isStatic = path.startsWith("/_next") || path.startsWith("/favicon")

  if (!user && !isApiRoute && !isLoginPage && !isStatic && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // If logged in and trying to visit /login, redirect to /
  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

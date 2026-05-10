import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const TOKEN_COOKIE_NAME = 'access_token'
const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token'
const ROLE_COOKIE_NAME = '16signals-role'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(TOKEN_COOKIE_NAME)?.value
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value
  const role = request.cookies.get(ROLE_COOKIE_NAME)?.value

  // 1. Protected routes (Authentication required)
  const isProfileRoute = pathname.startsWith('/profile')
  const isDashboardRoute = pathname.startsWith('/dashboard')
  const isHrRoute = pathname.startsWith('/hr')
  const isNewJobRoute = pathname.startsWith('/jobs/new')
  const isCandidateListRoute = pathname.startsWith('/candidates')
  const isAnalyticsRoute = pathname.startsWith('/analytics')
  const isPipelineRoute = pathname.startsWith('/pipeline')
  const isSettingsRoute = pathname.startsWith('/settings')

  const isProtectedRoute = isProfileRoute || isDashboardRoute || isHrRoute || isNewJobRoute || 
                           isCandidateListRoute || isAnalyticsRoute || isPipelineRoute || isSettingsRoute

  // Redirect only if BOTH access token and refresh token are missing
  if (isProtectedRoute && !token && !refreshToken) {
    const loginUrl = new URL('/auth', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 2. Role-based protection
  const hasAuth = !!(token || refreshToken)
  const isEmployerOnlyRoute = isHrRoute || isNewJobRoute || isCandidateListRoute || isAnalyticsRoute || isPipelineRoute
  
  if (hasAuth && isEmployerOnlyRoute && role !== 'employer') {
    return NextResponse.redirect(new URL('/profile', request.url))
  }

  const isCandidateOnlyRoute = isProfileRoute
  if (hasAuth && isCandidateOnlyRoute && role !== 'candidate') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    '/profile/:path*',
    '/dashboard/:path*',
    '/hr/:path*',
    '/jobs/new/:path*',
    '/candidates/:path*',
    '/analytics/:path*',
    '/pipeline/:path*',
    '/settings/:path*',
  ],
}

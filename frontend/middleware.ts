// middleware.ts - UPDATED
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server' // ✅ Fixed import

const TOKEN_COOKIE_NAME = '16signals-token'
const ROLE_COOKIE_NAME = '16signals-role'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(TOKEN_COOKIE_NAME)?.value
  const role = request.cookies.get(ROLE_COOKIE_NAME)?.value

  // ✅ FIXED: All HR routes start with /hr
  const isHrRoute = pathname.startsWith('/hr')
  const isHrJobsNewRoute = pathname === '/hr/jobs/new' || pathname.startsWith('/hr/jobs/new/')
  
  const isProfileRoute = pathname.startsWith('/profile')
  const isDashboardRoute = pathname.startsWith('/dashboard')
  const isCandidateListRoute = pathname.startsWith('/candidates')
  const isAnalyticsRoute = pathname.startsWith('/analytics')
  const isPipelineRoute = pathname.startsWith('/pipeline')
  const isSettingsRoute = pathname.startsWith('/settings')

  // ✅ Simplified: /hr covers all employer routes
  const isProtectedRoute = isProfileRoute || isDashboardRoute || isHrRoute || 
                           isCandidateListRoute || isAnalyticsRoute || isPipelineRoute || isSettingsRoute

  // Redirect unauthenticated users
  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/auth', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ✅ Role check: All /hr routes require employer role
  if (token && isHrRoute && role !== 'employer') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Candidate-only routes
  if (token && isProfileRoute && role !== 'candidate') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/profile/:path*',
    '/dashboard/:path*',
    '/hr/:path*',           // ✅ This covers /hr/jobs/new, /hr/candidates, etc.
    '/candidates/:path*',
    '/analytics/:path*',
    '/pipeline/:path*',
    '/settings/:path*',
    // ❌ Removed '/jobs/new/:path*' - not needed, covered by /hr/:path*
  ],
}
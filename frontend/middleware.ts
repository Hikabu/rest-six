import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: ['/profile/:path*', '/jobs/:path*', '/hr/:path*'],
}

function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1]
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) {
      base64 += '='
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

export default async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl

    const isCandidateRoute = pathname.startsWith('/profile') || pathname.startsWith('/jobs')
    const isEmployerRoute = pathname.startsWith('/hr')

    if (!isCandidateRoute && !isEmployerRoute) {
      return NextResponse.next()
    }

    const accessToken = request.cookies.get('access_token')?.value
    const refreshToken = request.cookies.get('refresh_token')?.value

    let payload = accessToken ? decodeJwt(accessToken) : null
    const now = Math.floor(Date.now() / 1000)

    let isTokenValid = payload && payload.exp && payload.exp > now
    let newCookies: string[] = []

    if (!isTokenValid) {
      if (!refreshToken) {
        return NextResponse.redirect(new URL('/auth?clear_session=true', request.url))
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const refreshEndpoint = isEmployerRoute ? '/auth/employer/refresh' : '/auth/candidate/refresh'

      const refreshRes = await fetch(`${apiUrl}${refreshEndpoint}`, {
        method: 'POST',
        headers: {
          Cookie: `refresh_token=${refreshToken}`,
        },
      })

      if (!refreshRes.ok) {
        return NextResponse.redirect(new URL('/auth?clear_session=true', request.url))
      }

      const setCookies = refreshRes.headers.getSetCookie ? refreshRes.headers.getSetCookie() : []
      if (setCookies.length > 0) {
        newCookies = setCookies
      } else {
        const fallbackCookie = refreshRes.headers.get('Set-Cookie')
        if (fallbackCookie) {
          newCookies = [fallbackCookie]
        }
      }

      try {
        const body = await refreshRes.json()
        if (body && body.data && body.data.accessToken) {
          payload = decodeJwt(body.data.accessToken)
        } else if (body && body.access_token) {
          payload = decodeJwt(body.access_token)
        }
      } catch (e) {
        // Fallback to previous payload if body parsing fails
      }
    }

    if (!payload || !payload.role) {
      return NextResponse.redirect(new URL('/auth?clear_session=true', request.url))
    }

    const role = String(payload.role).toLowerCase()

    if (isCandidateRoute) {
      if (role !== 'candidate') {
        return NextResponse.redirect(new URL('/auth?clear_session=true', request.url))
      }
    }

    if (isEmployerRoute) {
      if (!['employer', 'hr', 'hr_admin'].includes(role)) {
        return NextResponse.redirect(new URL('/profile', request.url))
      }
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-role', role)

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

    if (newCookies.length > 0) {
      newCookies.forEach((cookie) => response.headers.append('Set-Cookie', cookie))
    }

    return response
  } catch (error) {
    return NextResponse.redirect(new URL('/auth?clear_session=true', request.url))
  }
}

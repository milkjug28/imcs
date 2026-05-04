import { NextRequest, NextResponse } from 'next/server'

type RateLimitEntry = {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const ROUTE_LIMITS: { pattern: string; max: number; windowMs: number }[] = [
  { pattern: '/api/community/claim', max: 3, windowMs: 60_000 },
  { pattern: '/api/community/check-ownership', max: 10, windowMs: 60_000 },
  { pattern: '/api/community/check', max: 10, windowMs: 60_000 },
  { pattern: '/api/community/status', max: 20, windowMs: 60_000 },
  { pattern: '/api/', max: 30, windowMs: 60_000 },
]

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 60_000)

function getLimit(pathname: string) {
  for (const rule of ROUTE_LIMITS) {
    if (pathname.startsWith(rule.pattern)) return rule
  }
  return null
}

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const rule = getLimit(pathname)
  if (!rule) return NextResponse.next()

  const ip = getIP(req)
  const key = `${ip}:${rule.pattern}`
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + rule.windowMs })
    return NextResponse.next()
  }

  entry.count++

  if (entry.count > rule.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'slow down dummi. try agen later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(rule.max),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}

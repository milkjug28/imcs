import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const ip = getRequestIP(request)

    // Rate limit: 10 requests per minute per IP
    const rateLimitResult = rateLimit(`banish-lb:${ip}`, { limit: 10, windowMs: 60_000 })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'slow down dummie' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimitResult.retryAfter) },
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200)

    // Fetch all banishments
    const { data: banishments, error } = await supabase
      .from('banishments')
      .select('target_x_handle, target_wallet_address, reason, submitter_wallet, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Banish leaderboard error:', error)
      return NextResponse.json(
        { error: 'failed 2 load banish list' },
        { status: 500 }
      )
    }

    if (!banishments || banishments.length === 0) {
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      })
    }

    // Aggregate by target_x_handle
    const handleMap = new Map<string, {
      target_x_handle: string
      submission_count: number
      target_wallets: string[]
      sample_reasons: string[]
      first_submitted_at: string
    }>()

    for (const row of banishments) {
      const existing = handleMap.get(row.target_x_handle)
      if (!existing) {
        handleMap.set(row.target_x_handle, {
          target_x_handle: row.target_x_handle,
          submission_count: 1,
          target_wallets: row.target_wallet_address ? [row.target_wallet_address] : [],
          sample_reasons: [row.reason],
          first_submitted_at: row.created_at,
        })
      } else {
        existing.submission_count++
        if (
          row.target_wallet_address &&
          !existing.target_wallets.includes(row.target_wallet_address)
        ) {
          existing.target_wallets.push(row.target_wallet_address)
        }
        if (existing.sample_reasons.length < 3) {
          existing.sample_reasons.push(row.reason)
        }
      }
    }

    // Sort by submission count descending, then by earliest submission
    const result = Array.from(handleMap.values())
      .sort((a, b) => {
        if (b.submission_count !== a.submission_count) {
          return b.submission_count - a.submission_count
        }
        return new Date(a.first_submitted_at).getTime() - new Date(b.first_submitted_at).getTime()
      })
      .slice(0, limit)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('Banish leaderboard error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}

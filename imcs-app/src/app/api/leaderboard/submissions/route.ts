import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 10 requests per minute per IP (this is the heaviest endpoint)
    const ip = getRequestIP(request)
    const rl = rateLimit(`leaderboard:${ip}`, { limit: 10, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'slow down dummie' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      )
    }
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')
    const includeInfo = searchParams.get('include') === 'info'

    const { data: leaderboardEntries, error: leaderboardError } = await supabase
      .from('leaderboard_scores')
      .select('wallet_address, name, info, submission_score, task_points, voting_karma, total_points, created_at, whitelist_status')
      .order('total_points', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(Math.min(limit, 1000))

    if (leaderboardError) {
      console.error('Leaderboard fetch error:', leaderboardError)
      return NextResponse.json(
        { error: 'failed to fetch leaderboard' },
        { status: 500 }
      )
    }

    if (!leaderboardEntries || leaderboardEntries.length === 0) {
      return NextResponse.json([])
    }

    // Format results. Omit `info` unless requested to cut outgoing FOT.
    const limited = leaderboardEntries.map(entry => {
      const totalScore = Number(entry.total_points) || 0
      const base = {
        wallet_address: entry.wallet_address,
        name: entry.name || 'Unknown Savant',
        score: totalScore,
        submission_score: Number(entry.submission_score) || 0,
        voting_karma: Number(entry.voting_karma) || 0,
        task_points: Number(entry.task_points) || 0,
        created_at: entry.created_at || new Date().toISOString(),
        whitelist_status: entry.whitelist_status || (totalScore >= 1017 ? 'approved' : null),
      }
      return includeInfo ? { ...base, info: entry.info || '' } : base
    })

    return NextResponse.json(limited, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      }
    })
  } catch (error) {
    console.error('Leaderboard error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}

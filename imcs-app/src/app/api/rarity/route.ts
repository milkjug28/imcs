import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`rarity:${ip}`, { limit: 30, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const tokenId = request.nextUrl.searchParams.get('tokenId')
  if (!tokenId) {
    return NextResponse.json({ error: 'missing tokenId' }, { status: 400 })
  }

  const id = parseInt(tokenId)
  if (isNaN(id) || id < 1 || id > 4269) {
    return NextResponse.json({ error: 'invalid tokenId' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('savant_rarity')
      .select('rank, score, is_one_of_one, traits')
      .eq('token_id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ rank: null })
    }

    return NextResponse.json({
      tokenId: id,
      rank: data.rank,
      score: data.score,
      isOneOfOne: data.is_one_of_one,
      traits: data.traits,
      totalSupply: 4269,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch {
    return NextResponse.json({ rank: null })
  }
}

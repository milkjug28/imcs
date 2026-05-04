import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet')

    if (!wallet) {
      return NextResponse.json(
        { error: 'wallet param required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    if (!ETH_ADDRESS_RE.test(wallet)) {
      return NextResponse.json(
        { error: 'invalid wallet address format' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const normalized = wallet.toLowerCase()

    const { data: whitelistEntry } = await supabase
      .from('whitelist')
      .select('status, gtd, community, fcfs, source')
      .eq('wallet_address', normalized)
      .single()

    const { data: scoreEntry } = await supabase
      .from('leaderboard_scores')
      .select('total_points')
      .eq('wallet_address', normalized)
      .single()

    const totalPoints = scoreEntry ? (Number(scoreEntry.total_points) || 0) : 0

    if (!whitelistEntry || whitelistEntry.status !== 'approved') {
      return NextResponse.json(
        {
          wallet: normalized,
          found: false,
          phases: { gtd: false, community: false, fcfs: false },
          totalMints: 0,
          source: null,
          total_points: totalPoints,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const phases = {
      gtd: whitelistEntry.gtd || false,
      community: whitelistEntry.community || false,
      fcfs: whitelistEntry.fcfs || false,
    }

    const totalMints = Object.values(phases).filter(Boolean).length

    return NextResponse.json(
      {
        wallet: normalized,
        found: true,
        phases,
        totalMints,
        source: whitelistEntry.source || null,
        total_points: totalPoints,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Check error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

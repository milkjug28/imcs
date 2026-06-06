import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { supabase } from '@/lib/supabase'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'
import { WEEKLY_BURN_CAP, IQ_PER_BURN, weekStartUTC, weekResetsAt } from '@/lib/burn-week'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`iq-burn-status:${ip}`, { limit: 30, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const wallet = request.nextUrl.searchParams.get('wallet')?.toLowerCase()
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
  }

  const weekStart = weekStartUTC()
  const { data, error } = await supabase
    .from('trait_burns')
    .select('traits_burned')
    .eq('wallet_address', wallet)
    .gte('created_at', weekStart.toISOString())

  if (error) {
    console.error('burn status query failed:', error)
    return NextResponse.json({ error: 'could not read burn status' }, { status: 500 })
  }

  const burnedThisWeek = (data || []).reduce((s, r: { traits_burned: number }) => s + r.traits_burned, 0)
  const remaining = Math.max(0, WEEKLY_BURN_CAP - burnedThisWeek)

  return NextResponse.json({
    wallet,
    burnedThisWeek,
    remaining,
    cap: WEEKLY_BURN_CAP,
    iqPerBurn: IQ_PER_BURN,
    weekResetsAt: weekResetsAt().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

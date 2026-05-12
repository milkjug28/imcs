import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getLiveTradingIQ } from '@/lib/goldsky'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`iq-balance:${ip}`, { limit: 30, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const wallet = request.nextUrl.searchParams.get('wallet')?.toLowerCase()
  if (!wallet) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 })
  }

  const [balanceResult, snapshotResult, liveTrading] = await Promise.all([
    supabase
      .from('wallet_iq_balances')
      .select('total_earned, total_allocated, available, last_snapshot_id, updated_at')
      .eq('wallet', wallet)
      .single(),
    supabase
      .from('wallet_iq_snapshots')
      .select('leaderboard_iq, trading_iq, snapshot_id')
      .eq('wallet', wallet)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    getLiveTradingIQ(wallet),
  ])

  const balance = balanceResult.data
  const snapshot = snapshotResult.data

  if (!balance || !snapshot) {
    return NextResponse.json({
      wallet,
      total_earned: 0,
      total_allocated: 0,
      available: 0,
      trading: liveTrading,
    })
  }

  const liveTotal = snapshot.leaderboard_iq + liveTrading.tradingIQ

  if (liveTotal !== balance.total_earned) {
    const newEarned = liveTotal
    await supabase
      .from('wallet_iq_balances')
      .update({
        total_earned: newEarned,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet', wallet)

    const newAvailable = newEarned - balance.total_allocated
    return NextResponse.json({
      wallet,
      total_earned: newEarned,
      total_allocated: balance.total_allocated,
      available: newAvailable,
      trading: liveTrading,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.json({
    wallet,
    total_earned: balance.total_earned,
    total_allocated: balance.total_allocated,
    available: balance.available,
    trading: liveTrading,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

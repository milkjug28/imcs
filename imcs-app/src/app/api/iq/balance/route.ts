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

  const [balanceResult, snapshotResult, liveTrading, taskResult, packResult] = await Promise.all([
    supabase
      .from('wallet_iq_balances')
      .select('total_earned, total_allocated, available, last_snapshot_id, updated_at')
      .eq('wallet', wallet)
      .single(),
    supabase
      .from('wallet_iq_snapshots')
      .select('leaderboard_iq, trading_iq, bonus_iq, snapshot_id')
      .eq('wallet', wallet)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    getLiveTradingIQ(wallet),
    supabase
      .from('iq_task_completions')
      .select('iq_awarded')
      .eq('wallet_address', wallet),
    supabase
      .from('pack_rips')
      .select('iq_awarded')
      .eq('wallet_address', wallet),
  ])

  const balance = balanceResult.data
  const snapshot = snapshotResult.data
  const taskIQ = (taskResult.data || []).reduce((sum: number, t: { iq_awarded: number }) => sum + t.iq_awarded, 0)
  const packIQ = (packResult.data || []).reduce((sum: number, p: { iq_awarded: number }) => sum + p.iq_awarded, 0)

  if (!balance || !snapshot) {
    const earned = taskIQ + packIQ
    return NextResponse.json({
      wallet,
      total_earned: earned,
      total_allocated: 0,
      available: earned,
      trading: liveTrading,
    })
  }

  // Stable base = IQ earned outside of volatile trading (leaderboard award, hold/diamond
  // bonus, tasks, packs). Trading IQ can ADD to the pool when positive, but a sell penalty
  // can never drag total_earned below the stable base — it only burns the trading bonus.
  // This keeps `available` from stranding allocations when a holder later sells.
  const stableBase = snapshot.leaderboard_iq + (snapshot.bonus_iq || 0) + taskIQ + packIQ
  const liveTotal = stableBase + liveTrading.tradingIQ
  const earned = Math.max(liveTotal, stableBase)
  // `available` is a Postgres generated column GREATEST(0, total_earned - total_allocated),
  // so we only persist total_earned; available follows automatically and floors at 0.
  if (earned !== balance.total_earned) {
    await supabase
      .from('wallet_iq_balances')
      .update({ total_earned: earned, updated_at: new Date().toISOString() })
      .eq('wallet', wallet)
  }

  return NextResponse.json({
    wallet,
    total_earned: earned,
    total_allocated: balance.total_allocated,
    available: Math.max(0, earned - balance.total_allocated),
    trading: liveTrading,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

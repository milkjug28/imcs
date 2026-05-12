import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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

  const { data: balance, error } = await supabase
    .from('wallet_iq_balances')
    .select('total_earned, total_allocated, available, updated_at')
    .eq('wallet', wallet)
    .single()

  if (error || !balance) {
    return NextResponse.json({
      wallet,
      total_earned: 0,
      total_allocated: 0,
      available: 0,
    })
  }

  return NextResponse.json({
    wallet,
    ...balance,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

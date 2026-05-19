import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { IQ_TASKS } from '@/lib/iq-tasks'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'
import { getAddress, isAddress } from 'viem'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`iq-claim:${ip}`, { limit: 10, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const body = await request.json()
  const { wallet, task_type } = body

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
  }
  if (!task_type) {
    return NextResponse.json({ error: 'task_type required' }, { status: 400 })
  }

  const task = IQ_TASKS.find(t => t.id === task_type)
  if (!task) {
    return NextResponse.json({ error: 'unknown task' }, { status: 400 })
  }

  const walletLower = wallet.toLowerCase()
  const checksummed = getAddress(wallet)

  if (task_type === 'link_discord') {
    const { data: walletRecord } = await supabase
      .from('discord_wallets')
      .select('discord_user_id')
      .eq('wallet_address', checksummed)
      .single()

    if (!walletRecord) {
      return NextResponse.json({ error: 'discrod not linked 2 dis wallet' }, { status: 400 })
    }

    const { data: existingClaim } = await supabase
      .from('iq_task_completions')
      .select('id, wallet_address')
      .eq('task_type', 'link_discord')
      .contains('metadata', { discord_user_id: walletRecord.discord_user_id })
      .single()

    if (existingClaim) {
      return NextResponse.json({
        error: 'dis discrod already claimed iq on another wallet',
        claimed_wallet: existingClaim.wallet_address,
      }, { status: 409 })
    }

    const { data: verification } = await supabase
      .from('discord_verifications')
      .select('discord_username')
      .eq('discord_user_id', walletRecord.discord_user_id)
      .single()

    const { error } = await supabase
      .from('iq_task_completions')
      .insert({
        wallet_address: walletLower,
        task_type: 'link_discord',
        iq_awarded: task.iq_reward,
        metadata: {
          discord_user_id: walletRecord.discord_user_id,
          discord_username: verification?.discord_username || null,
        },
      })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'already claimed' }, { status: 409 })
      }
      console.error('claim insert error:', error)
      return NextResponse.json({ error: 'claim failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, iq_awarded: task.iq_reward })
  }

  return NextResponse.json({ error: 'task not claimable' }, { status: 400 })
}

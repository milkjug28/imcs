import { NextRequest, NextResponse } from 'next/server'
import { isAddress, parseEventLogs, zeroAddress } from 'viem'
import { supabase } from '@/lib/supabase'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'
import { getBaseClient, EQUIPMENT_ADDRESS } from '@/lib/base-client'
import { traits } from '@/lib/trait-data'
import { WEEKLY_BURN_CAP, IQ_PER_BURN, weekStartUTC } from '@/lib/burn-week'

export const dynamic = 'force-dynamic'

const PACK_TOKEN_ID = Number(process.env.NEXT_PUBLIC_PACK_TOKEN_ID || 999000)

const ERC1155_TRANSFER_ABI = [
  {
    type: 'event',
    name: 'TransferSingle',
    inputs: [
      { indexed: true, name: 'operator', type: 'address' },
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'id', type: 'uint256' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'TransferBatch',
    inputs: [
      { indexed: true, name: 'operator', type: 'address' },
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'ids', type: 'uint256[]' },
      { indexed: false, name: 'values', type: 'uint256[]' },
    ],
  },
] as const

type BurnBody = { wallet?: string; txHash?: string }

export async function POST(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`iq-burn:${ip}`, { limit: 10, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  let body: BurnBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const wallet = body.wallet?.toLowerCase()
  const txHash = body.txHash
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
  }
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return NextResponse.json({ error: 'invalid tx hash' }, { status: 400 })
  }

  // idempotency: a given burn tx can only be claimed once
  const { data: existing } = await supabase
    .from('trait_burns')
    .select('iq_awarded, traits_burned')
    .eq('tx_hash', txHash)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyClaimed: true,
      credited: existing.iq_awarded,
      traitsBurned: existing.traits_burned,
    })
  }

  // pull + verify the receipt on Base
  let receipt
  try {
    receipt = await getBaseClient().getTransactionReceipt({ hash: txHash as `0x${string}` })
  } catch {
    return NextResponse.json({ error: 'tx not found or not confirmed yet' }, { status: 400 })
  }
  if (receipt.status !== 'success') {
    return NextResponse.json({ error: 'burn tx failed on-chain' }, { status: 400 })
  }
  if (receipt.from.toLowerCase() !== wallet) {
    return NextResponse.json({ error: 'tx sender does not match wallet' }, { status: 403 })
  }

  // parse ERC1155 burns (to == 0x0) from the equipment contract, sent by this wallet
  const parsed = parseEventLogs({ abi: ERC1155_TRANSFER_ABI, logs: receipt.logs })
  let burnedCount = 0
  const burnedIds: number[] = []
  for (const log of parsed) {
    if (log.address.toLowerCase() !== EQUIPMENT_ADDRESS.toLowerCase()) continue
    const a = log.args as Record<string, unknown>
    if ((a.to as string).toLowerCase() !== zeroAddress) continue
    if ((a.from as string).toLowerCase() !== wallet) continue

    const pairs: Array<[bigint, bigint]> =
      log.eventName === 'TransferSingle'
        ? [[a.id as bigint, a.value as bigint]]
        : (a.ids as bigint[]).map((id, i) => [id, (a.values as bigint[])[i]])

    for (const [id, value] of pairs) {
      const tid = Number(id)
      // only real traits count; ignore pack-token burns or unknown ids
      if (tid === PACK_TOKEN_ID || !traits[tid]) continue
      const v = Number(value)
      burnedCount += v
      for (let n = 0; n < v; n++) burnedIds.push(tid)
    }
  }

  if (burnedCount <= 0) {
    return NextResponse.json({ error: 'no trait burns found in tx' }, { status: 400 })
  }

  // weekly cap: credit only up to the remaining allowance (burn already happened on-chain)
  const weekStart = weekStartUTC()
  const { data: weekRows } = await supabase
    .from('trait_burns')
    .select('traits_burned')
    .eq('wallet_address', wallet)
    .gte('created_at', weekStart.toISOString())
  const burnedThisWeek = (weekRows || []).reduce((s, r: { traits_burned: number }) => s + r.traits_burned, 0)
  const remaining = Math.max(0, WEEKLY_BURN_CAP - burnedThisWeek)
  const creditable = Math.min(burnedCount, remaining)
  const iqAwarded = creditable * IQ_PER_BURN

  // record the burn (idempotent on tx_hash). traits_burned reflects what actually
  // burned on-chain; iq_awarded reflects the capped credit.
  const { error: insErr } = await supabase.from('trait_burns').insert({
    wallet_address: wallet,
    tx_hash: txHash,
    traits_burned: burnedCount,
    iq_awarded: iqAwarded,
    trait_ids: burnedIds,
  })
  if (insErr) {
    // unique violation = a concurrent claim landed first; treat as already claimed
    if ((insErr as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: true, alreadyClaimed: true }, { status: 200 })
    }
    console.error('trait_burns insert failed:', insErr)
    return NextResponse.json({ error: 'could not record burn' }, { status: 500 })
  }

  // bump cached IQ balance so `available` is immediately allocatable. The balance
  // GET route recomputes total_earned from components (incl. trait_burns) and will
  // overwrite this with the same value, so there is no double-count.
  if (iqAwarded > 0) {
    const { data: bal } = await supabase
      .from('wallet_iq_balances')
      .select('total_earned')
      .eq('wallet', wallet)
      .maybeSingle()
    if (bal) {
      await supabase
        .from('wallet_iq_balances')
        .update({ total_earned: bal.total_earned + iqAwarded, updated_at: new Date().toISOString() })
        .eq('wallet', wallet)
    } else {
      await supabase
        .from('wallet_iq_balances')
        .insert({ wallet, total_earned: iqAwarded, total_allocated: 0 })
    }
  }

  return NextResponse.json({
    ok: true,
    traitsBurned: burnedCount,
    credited: iqAwarded,
    capped: creditable < burnedCount,
    remaining: Math.max(0, remaining - creditable),
  })
}

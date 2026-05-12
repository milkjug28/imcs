import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage } from 'viem'
import { supabase } from '@/lib/supabase'
import { getBaseIQ } from '@/lib/iq'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY!
const SAVANT_TOKEN = '0x95fa6fc553F5bE3160b191b0133236367A835C63'

type Allocation = {
  tokenId: number
  points: number
}

type RequestBody = {
  wallet: string
  allocations: Allocation[]
  signature: string
  message: string
}

function buildExpectedMessage(wallet: string, allocations: Allocation[]): string {
  const lines = allocations.map(a => `  Savant #${a.tokenId}: +${a.points} IQ`)
  const total = allocations.reduce((s, a) => s + a.points, 0)
  return [
    'Allocate IQ Points to Savants',
    '',
    ...lines,
    '',
    `Total: ${total} IQ points`,
    '',
    'This action is permanent and cannot be undone.',
    '',
    `Wallet: ${wallet.toLowerCase()}`,
  ].join('\n')
}

async function verifyOwnership(wallet: string, tokenIds: number[]): Promise<boolean> {
  const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${wallet}&contractAddresses[]=${SAVANT_TOKEN}&withMetadata=false&pageSize=100`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return false

  const data = await res.json()
  const ownedIds = new Set(
    (data.ownedNfts || []).map((n: { tokenId: string }) => parseInt(n.tokenId))
  )

  return tokenIds.every(id => ownedIds.has(id))
}

export async function POST(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`iq-allocate:${ip}`, { limit: 5, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { wallet, allocations, signature, message } = body

  if (!wallet || !allocations?.length || !signature || !message) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const normalizedWallet = wallet.toLowerCase()

  if (allocations.some(a => !Number.isInteger(a.points) || a.points < 1)) {
    return NextResponse.json({ error: 'points must be positive integers' }, { status: 400 })
  }

  if (allocations.some(a => !Number.isInteger(a.tokenId) || a.tokenId < 1)) {
    return NextResponse.json({ error: 'invalid token ids' }, { status: 400 })
  }

  const totalAllocating = allocations.reduce((s, a) => s + a.points, 0)

  const expectedMessage = buildExpectedMessage(wallet, allocations)
  if (message !== expectedMessage) {
    return NextResponse.json({ error: 'message mismatch' }, { status: 400 })
  }

  let verified = false
  try {
    verified = await verifyMessage({
      address: wallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
  } catch {
    return NextResponse.json({ error: 'signature verification failed' }, { status: 400 })
  }

  if (!verified) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const tokenIds = allocations.map(a => a.tokenId)
  const ownsAll = await verifyOwnership(normalizedWallet, tokenIds)
  if (!ownsAll) {
    return NextResponse.json({ error: 'u dont own all those savants' }, { status: 403 })
  }

  const { data: balance, error: balErr } = await supabase
    .from('wallet_iq_balances')
    .select('total_earned, total_allocated, available')
    .eq('wallet', normalizedWallet)
    .single()

  if (balErr || !balance) {
    return NextResponse.json({ error: 'no iq balance found for wallet' }, { status: 404 })
  }

  if (balance.available < totalAllocating) {
    return NextResponse.json({
      error: `not enough points. available: ${balance.available}, requested: ${totalAllocating}`,
    }, { status: 400 })
  }

  const results: { tokenId: number; totalIQ: number }[] = []

  for (const alloc of allocations) {
    const { data: existing } = await supabase
      .from('savant_iq')
      .select('iq_points')
      .eq('token_id', alloc.tokenId)
      .single()

    const currentAllocated = existing?.iq_points ?? 0
    const newAllocated = currentAllocated + alloc.points

    const { error: upsertErr } = await supabase
      .from('savant_iq')
      .upsert({
        token_id: alloc.tokenId,
        iq_points: newAllocated,
        allocated_by: normalizedWallet,
        last_updated_at: new Date().toISOString(),
        ...(!existing && { allocated_at: new Date().toISOString() }),
      }, { onConflict: 'token_id' })

    if (upsertErr) {
      console.error(`Failed to upsert savant_iq for token ${alloc.tokenId}:`, upsertErr)
      return NextResponse.json({ error: `failed on token ${alloc.tokenId}` }, { status: 500 })
    }

    results.push({ tokenId: alloc.tokenId, totalIQ: getBaseIQ(alloc.tokenId) + newAllocated })
  }

  const { error: balUpdate } = await supabase
    .from('wallet_iq_balances')
    .update({
      total_allocated: balance.total_allocated + totalAllocating,
      updated_at: new Date().toISOString(),
    })
    .eq('wallet', normalizedWallet)

  if (balUpdate) {
    console.error('Failed to update wallet balance:', balUpdate)
    return NextResponse.json({ error: 'balance update failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    allocated: totalAllocating,
    remaining: balance.available - totalAllocating,
    savants: results,
  })
}

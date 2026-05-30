import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'
import { getInventory } from '@/lib/base-client'
import { traits } from '@/lib/trait-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`trait-inventory:${ip}`, { limit: 30, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const wallet = request.nextUrl.searchParams.get('wallet')
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
  }

  const allTraitIds = Object.keys(traits)
    .map(Number)
    .filter(id => !traits[id].hidden)

  const balances = await getInventory(wallet as `0x${string}`, allTraitIds)

  const inventory = [...balances.entries()].map(([traitId, balance]) => ({
    traitId,
    balance,
    trait: traits[traitId],
  }))

  return NextResponse.json({ wallet, inventory })
}

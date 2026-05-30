import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'
import { getEquipped, EQUIP_MANAGER_ADDRESS } from '@/lib/base-client'
import { traits, SLOT_NAMES } from '@/lib/trait-data'
import tokenTraitsData from '../../../../../../imcs-deployment/data/token-traits.json'

export const dynamic = 'force-dynamic'

const tokenTraits = tokenTraitsData as Record<string, number[]>

async function getSlots(tokenId: number): Promise<number[]> {
  if (EQUIP_MANAGER_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return tokenTraits[String(tokenId)] || Array(10).fill(0)
  }
  return getEquipped(tokenId)
}

export async function GET(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`trait-equipped:${ip}`, { limit: 30, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const tokenId = parseInt(request.nextUrl.searchParams.get('tokenId') || '')
  if (isNaN(tokenId) || tokenId < 1 || tokenId > 4269) {
    return NextResponse.json({ error: 'invalid token id' }, { status: 400 })
  }

  const slots = await getSlots(tokenId)

  const equipment = slots.map((traitId, i) => ({
    slot: i,
    slotName: SLOT_NAMES[i],
    traitId,
    trait: traitId > 0 ? traits[traitId] || null : null,
  }))

  return NextResponse.json({ tokenId, equipment })
}

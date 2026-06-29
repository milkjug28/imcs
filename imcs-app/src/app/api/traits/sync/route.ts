import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'
import { getEquipped, getTokenCombo, EQUIP_MANAGER_ADDRESS } from '@/lib/base-client'
import { traits } from '@/lib/trait-data'
import { normalizeTrait } from '@/lib/trait-normalize'
import { compositeSavant } from '@/lib/trait-renderer'
import { supabase } from '@/lib/supabase'
import tokenTraitsData from '../../../../../../imcs-deployment/data/token-traits.json'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Canonical public base for PERSISTED metadata image URLs. The DB is shared
// across every environment (local + prod hit the same Supabase), so the stored
// image must ALWAYS be the production domain regardless of where this sync runs.
// NEVER derive this from request.nextUrl.origin — running sync from localhost
// would otherwise write http://localhost:3001 image URLs into prod metadata.
const PUBLIC_BASE = (process.env.METADATA_PUBLIC_BASE || 'https://www.imcs.world').replace(/\/$/, '')

const BUCKET = 'savant-composites'
const SLOT_DIR = ["bg's", 'bods', 'cloths', 'speshul', 'ayezz', 'moufs', 'facessories', 'hatss', 'extruhs', 'textuh']
const tokenTraits = tokenTraitsData as Record<string, number[]>

async function getSlots(tokenId: number): Promise<number[]> {
  if (EQUIP_MANAGER_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return tokenTraits[String(tokenId)] || Array(10).fill(0)
  }
  return getEquipped(tokenId)
}

function buildAttributes(slots: number[]) {
  const attrs: { trait_type: string; value: string }[] = []
  for (let slot = 0; slot < 10; slot++) {
    const id = slots[slot]
    if (id > 0 && traits[id]) {
      const type = SLOT_DIR[slot]
      attrs.push({ trait_type: type, value: normalizeTrait(type, traits[id].name) })
    }
  }
  return attrs
}

export async function POST(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`trait-sync:${ip}`, { limit: 10, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const tokenId = parseInt(request.nextUrl.searchParams.get('tokenId') || '')
  if (isNaN(tokenId) || tokenId < 1 || tokenId > 4269) {
    return NextResponse.json({ error: 'invalid token id' }, { status: 400 })
  }

  // Alchemy read nodes lag behind the just-mined tx. If the caller knows the
  // combo hash the change should produce, poll tokenToCombo until it settles so
  // we composite the NEW state, not the stale one.
  const expectedCombo = request.nextUrl.searchParams.get('expectedCombo')
  if (expectedCombo && EQUIP_MANAGER_ADDRESS !== '0x0000000000000000000000000000000000000000') {
    const want = expectedCombo.toLowerCase()
    for (let i = 0; i < 12; i++) {
      try {
        const onchain = (await getTokenCombo(tokenId)).toLowerCase()
        if (onchain === want) break
      } catch { /* retry */ }
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  try {
    const slots = await getSlots(tokenId)
    const png = await compositeSavant(slots, tokenId)

    const path = `${tokenId}.png`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, png, { contentType: 'image/png', upsert: true })
    if (upErr) {
      console.error('sync upload error:', upErr)
      return NextResponse.json({ error: 'upload failed' }, { status: 500 })
    }

    // Store a pretty, domain-owned URL (proxy route 307s to the bucket object).
    // ?v= busts OpenSea / browser image cache on each change.
    const imageUrl = `${PUBLIC_BASE}/api/traits/composite/${tokenId}.png?v=${Date.now()}`

    const attributes = buildAttributes(slots)

    const { error: dbErr } = await supabase
      .from('savant_metadata')
      .update({ image: imageUrl, attributes })
      .eq('token_id', tokenId)
    if (dbErr) {
      console.error('sync db error:', dbErr)
      return NextResponse.json({ error: 'db update failed' }, { status: 500 })
    }

    // ask OpenSea to re-pull metadata so the new composite shows there too.
    // fire-and-forget: our DB image already updated; OS lag shouldn't block the response.
    const osKey = process.env.OPENSEA_API_KEY
    if (osKey) {
      const SAVANT_NFT = '0x95fa6fc553F5bE3160b191b0133236367A835C63'
      fetch(`https://api.opensea.io/api/v2/chain/ethereum/contract/${SAVANT_NFT}/nfts/${tokenId}/refresh`, {
        method: 'POST', headers: { 'X-API-KEY': osKey, accept: 'application/json' },
      }).catch(() => { /* non-fatal: OS will re-index eventually */ })
    }

    return NextResponse.json({ ok: true, tokenId, image: imageUrl, slots, attributes })
  } catch (error) {
    console.error('sync error:', error)
    return NextResponse.json({ error: 'sync failed' }, { status: 500 })
  }
}

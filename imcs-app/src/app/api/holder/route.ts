import { NextRequest, NextResponse } from 'next/server'
import { isAddress, getAddress } from 'viem'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'
import { supabase } from '@/lib/supabase'
import { getBaseIQ } from '@/lib/iq'
import { getOwnedTokenIds } from '@/lib/alchemy'

export const dynamic = 'force-dynamic'

const IPFS_GATEWAY = 'https://maroon-adequate-gazelle-687.mypinata.cloud/ipfs/'

function resolveImage(raw: string | null): string {
  if (!raw) return ''
  if (raw.startsWith('ipfs://')) return IPFS_GATEWAY + raw.slice(7)
  return raw
}

export async function GET(request: NextRequest) {
  try {
    const ip = getRequestIP(request)
    const rl = rateLimit(`holder:${ip}`, { limit: 15, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json({ error: 'slow down' }, { status: 429 })
    }

    const wallet = request.nextUrl.searchParams.get('wallet')
    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
    }

    const checksummed = getAddress(wallet)

    // Ownership (the flaky Alchemy part) is cached with stale fallbacks inside
    // getOwnedTokenIds. IQ / savantName / metadata are NOT cached here: they
    // change on allocate/name/equip and the client force-refetches right after
    // those mutations, so this response must always reflect current DB state.
    let tokenIds: number[]
    try {
      const result = await getOwnedTokenIds(checksummed)
      tokenIds = result.tokenIds
    } catch {
      return NextResponse.json({ error: 'alchemy error' }, { status: 502 })
    }

    const [iqResult, metaResult] =
      tokenIds.length > 0
        ? await Promise.all([
            supabase
              .from('savant_iq')
              .select('token_id, iq_points, savant_name')
              .in('token_id', tokenIds),
            supabase
              .from('savant_metadata')
              .select('token_id, name, image, attributes')
              .in('token_id', tokenIds),
          ])
        : [{ data: [] }, { data: [] }]

    const iqMap = new Map<
      number,
      { allocated: number; savantName: string | null }
    >()
    if (iqResult.data) {
      for (const row of iqResult.data) {
        iqMap.set(row.token_id, {
          allocated: row.iq_points || 0,
          savantName: row.savant_name || null,
        })
      }
    }

    type MetaRow = {
      name: string | null
      image: string | null
      attributes:
        | { trait_type: string; value: string | number }[]
        | null
    }
    const metaMap = new Map<number, MetaRow>()
    if (metaResult.data) {
      for (const row of metaResult.data as (MetaRow & {
        token_id: number
      })[]) {
        metaMap.set(row.token_id, {
          name: row.name,
          image: row.image,
          attributes: row.attributes,
        })
      }
    }

    const tokens = tokenIds.map((id) => {
      const iqData = iqMap.get(id)
      const meta = metaMap.get(id)
      const totalIQ = getBaseIQ(id) + (iqData?.allocated ?? 0)
      const attrs = meta?.attributes || []
      return {
        tokenId: String(id),
        name: meta?.name || `#${id}`,
        image: resolveImage(meta?.image ?? null),
        iq: totalIQ,
        savantName: iqData?.savantName || null,
        traits: attrs
          .filter(
            (a) => a.trait_type !== 'IQ' && a.trait_type !== 'Trait Count',
          )
          .map((a) => ({
            type: a.trait_type,
            value: String(a.value),
          })),
      }
    })

    return NextResponse.json({
      wallet: checksummed,
      balance: tokens.length,
      tokens,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json(
      { error: 'failed to fetch holdings' },
      { status: 500 },
    )
  }
}

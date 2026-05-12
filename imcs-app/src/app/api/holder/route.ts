import { NextRequest, NextResponse } from 'next/server'
import { isAddress, getAddress } from 'viem'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'
import { supabase } from '@/lib/supabase'
import { getBaseIQ } from '@/lib/iq'

export const dynamic = 'force-dynamic'

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY!
const SAVANT_TOKEN = '0x95fa6fc553F5bE3160b191b0133236367A835C63'
const IPFS_GATEWAY = 'https://maroon-adequate-gazelle-687.mypinata.cloud/ipfs/'

type AlchemyNft = {
  tokenId: string
  name: string
  image: { cachedUrl?: string; originalUrl?: string }
  raw: {
    metadata: {
      name: string
      image: string
      attributes: { trait_type: string; value: string | number; max_value?: number }[]
    }
  }
}

function resolveImage(nft: AlchemyNft): string {
  const raw = nft.raw?.metadata?.image || ''
  if (raw.startsWith('ipfs://')) return IPFS_GATEWAY + raw.slice(7)
  const cached = nft.image?.cachedUrl || ''
  if (cached.includes('/ipfs/')) return IPFS_GATEWAY + cached.split('/ipfs/')[1]
  return cached || raw
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

    const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${checksummed}&contractAddresses[]=${SAVANT_TOKEN}&withMetadata=true&pageSize=100`

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: 'alchemy error' }, { status: 502 })
    }

    const data = await res.json()
    const nfts = (data.ownedNfts || []) as AlchemyNft[]

    const tokenIds = nfts.map(n => parseInt(n.tokenId))
    const { data: iqRows } = tokenIds.length > 0
      ? await supabase.from('savant_iq').select('token_id, iq_points').in('token_id', tokenIds)
      : { data: [] }

    const allocatedMap = new Map<number, number>()
    if (iqRows) {
      for (const row of iqRows) {
        allocatedMap.set(row.token_id, row.iq_points)
      }
    }

    const tokens = nfts.map(nft => {
      const id = parseInt(nft.tokenId)
      const allocated = allocatedMap.get(id) ?? 0
      const totalIQ = getBaseIQ(id) + allocated
      const attrs = nft.raw?.metadata?.attributes || []
      return {
        tokenId: nft.tokenId,
        name: nft.raw?.metadata?.name || `#${nft.tokenId}`,
        image: resolveImage(nft),
        iq: totalIQ,
        traits: attrs.filter(a => a.trait_type !== 'IQ' && a.trait_type !== 'Trait Count').map(a => ({
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
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' }
    })
  } catch {
    return NextResponse.json({ error: 'failed to fetch holdings' }, { status: 500 })
  }
}
